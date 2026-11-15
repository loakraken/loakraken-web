// Splits the test files over the CI shards by measured time (e2e.yml, shard jobs).
//
// Why: `--shard` cuts the list into runs of equal test count, so the long first-paint sweeps and
// a7-controls, which sit close together in file order, landed on the same shards: three shards ran
// ~31 min of tests (16 min wall, 25 min timeout) while the other three ran 12-15 min.
//
// How: each file weighs its measured time (shard-times.json, from a develop run), scaled by how many
// tests it has now against then; a file not in the table weighs its test count times the table's
// mean time per test. Files go heaviest first to the lightest shard (ties: file name, shard number),
// so the plan is the same on every shard job. A file never splits: its tests share the shard's
// workers (fullyParallel). Every listed file lands on exactly one shard, and the 'e2e' job still
// checks that the merged report holds every listed test.
//
//   npx playwright test <projects> --list --reporter=json > shard-list.json
//   node shard-plan.mjs shard-list.json <shard> <total>   → one file pattern per line
//
// Refresh shard-times.json when the shard jobs' times drift apart: from a finished develop run,
//   gh run view <run id> --log > e2e.log && node shard-times-from-log.mjs e2e.log <run id> > shard-times.json
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Test count per file in a `--list --reporter=json` report (all projects together). */
export function listedFiles(report) {
  const counts = new Map();
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      // The report holds every loaded file's specs; those of projects not asked for have no tests.
      const tests = (spec.tests ?? []).length;
      if (!tests) continue;
      const file = spec.file.replaceAll("\\", "/");
      counts.set(file, (counts.get(file) ?? 0) + tests);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return counts;
}

/**
 * Shards as arrays of files, heaviest-first greedy packing by measured time.
 * @param {Map<string, number>} counts test count per file
 * @param {Record<string, [number, number]>} times measured [ms, tests] per file
 * @param {number} total number of shards
 * @returns {{ ms: number, files: string[] }[]}
 */
export function planShards(counts, times, total) {
  const known = Object.values(times);
  const perTest = known.reduce((sum, [ms]) => sum + ms, 0) / Math.max(1, known.reduce((sum, [, n]) => sum + n, 0));
  const weight = (file, tests) => {
    const [ms, then] = times[file] ?? [0, 0];
    return then > 0 ? (ms * tests) / then : tests * perTest;
  };
  const files = [...counts]
    .filter(([, tests]) => tests > 0)
    .map(([file, tests]) => ({ file, ms: weight(file, tests) }))
    .sort((a, b) => b.ms - a.ms || a.file.localeCompare(b.file));
  const shards = Array.from({ length: total }, () => ({ ms: 0, files: /** @type {string[]} */ ([]) }));
  for (const { file, ms } of files) {
    const lightest = shards.reduce((best, shard) => (shard.ms < best.ms ? shard : best));
    lightest.files.push(file);
    lightest.ms += ms;
  }
  return shards;
}

/** A CLI pattern that matches exactly this file (Playwright matches it as a regex on the full path). */
export const filePattern = (file) =>
  `(/|\\\\)${file.split("/").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(/|\\\\)")}$`;

/**
 * Problems with a plan, [] when none: every spec file (the shard projects' testMatch folders) must be run
 * by exactly one of the shards or by the serial projects (isolated · solo), and every file the shard
 * projects list must be on exactly one shard.
 * @param {string[]} specFiles spec files found on disk, relative to testDir
 * @param {Map<string, number>} shardListed files the shard projects list
 * @param {Map<string, number>} serialListed files the serial projects list
 * @param {{ files: string[] }[]} plan
 */
export function coverageProblems(specFiles, shardListed, serialListed, plan) {
  const problems = [];
  const placed = new Map();
  for (const shard of plan) for (const file of shard.files) placed.set(file, (placed.get(file) ?? 0) + 1);
  for (const [file, times] of placed) if (times !== 1) problems.push(`${file}: on ${times} shards`);
  for (const [file, tests] of shardListed) if (tests > 0 && !placed.has(file)) problems.push(`${file}: listed but on no shard`);
  for (const file of specFiles) {
    const runs = (placed.has(file) ? 1 : 0) + (serialListed.has(file) ? 1 : 0);
    if (runs === 0) problems.push(`${file}: a spec file no shard or serial project runs`);
    if (runs === 2) problems.push(`${file}: run by a shard and by a serial project`);
  }
  return problems;
}

/** Spec files under the shard projects' testMatch folders (smoke/, regression/), relative to this folder. */
export function specFilesOnDisk() {
  const here = fileURLToPath(new URL(".", import.meta.url));
  return ["smoke", "regression"].flatMap((dir) =>
    readdirSync(join(here, dir), { recursive: true })
      .map((file) => `${dir}/${String(file).replaceAll("\\", "/")}`)
      .filter((file) => file.endsWith(".spec.mjs")),
  );
}

const readTimes = () => JSON.parse(readFileSync(new URL("./shard-times.json", import.meta.url), "utf8")).files;

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === "--verify") {
  // node shard-plan.mjs --verify <shard-list.json> <serial-list.json> <total>
  const [, shardList, serialList, totalArg] = process.argv.slice(2);
  const shardListed = listedFiles(JSON.parse(readFileSync(shardList, "utf8")));
  const serialListed = listedFiles(JSON.parse(readFileSync(serialList, "utf8")));
  const plan = planShards(shardListed, readTimes(), Number(totalArg));
  const specFiles = specFilesOnDisk();
  const problems = coverageProblems(specFiles, shardListed, serialListed, plan);
  for (const problem of problems) console.error(`::error title=shard plan::${problem}`);
  if (problems.length) process.exit(1);
  console.error(
    `plan covers all ${specFiles.length} spec files once: ${plan.reduce((n, s) => n + s.files.length, 0)} on the shards, ` +
      `${serialListed.size} serial`,
  );
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [list, shardArg, totalArg] = process.argv.slice(2);
  const shard = Number(shardArg);
  const total = Number(totalArg);
  if (!list || !(shard >= 1 && shard <= total)) throw new Error("Usage: node shard-plan.mjs <list.json> <shard> <total>");
  const plan = planShards(listedFiles(JSON.parse(readFileSync(list, "utf8"))), readTimes(), total);
  const mine = plan[shard - 1];
  // An empty list would run every test: never print one.
  if (!mine.files.length) throw new Error(`shard ${shard}/${total} got no files`);
  console.error(
    `shard ${shard}/${total}: ${mine.files.length} files, ~${(mine.ms / 60000).toFixed(1)} min of tests ` +
      `(all shards: ${plan.map((s) => (s.ms / 60000).toFixed(1)).join(" / ")})`,
  );
  for (const file of mine.files) console.log(filePattern(file));
}
