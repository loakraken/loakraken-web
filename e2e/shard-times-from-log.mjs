// Per-file test time for shard-plan.mjs, from a develop E2E run's log (the list reporter's lines):
//   gh run view <run id> --log > e2e.log && node shard-times-from-log.mjs e2e.log <run id> > shard-times.json
import { readFileSync } from "node:fs";
const [log, run] = process.argv.slice(2);
const unit = { ms: 1, s: 1000, m: 60000 };
const files = {};
for (const line of readFileSync(log, "utf8").split("\n")) {
  const m = line.match(/e2e shard \d\/\d.*?[✓✘-]\s+\d+\s+\[[^\]]+\]\s+›\s+(\S+?):\d+:\d+ ›.*\((\d+(?:\.\d+)?)(ms|s|m)\)\s*$/);
  if (!m) continue;
  const file = m[1].replaceAll("\\", "/");
  files[file] ??= [0, 0];
  files[file][0] += Math.round(+m[2] * unit[m[3]]);
  files[file][1]++;
}
const lines = Object.keys(files).sort().map((f) => `    ${JSON.stringify(f)}: [${files[f][0]}, ${files[f][1]}]`);
console.log(`{\n  "source": "develop E2E run ${run}: per test file, [ms summed over the shard projects, number of tests]",\n  "files": {\n${lines.join(",\n")}\n  }\n}`);
