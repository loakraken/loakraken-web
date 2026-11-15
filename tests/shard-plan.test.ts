import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  coverageProblems,
  filePattern,
  listedFiles,
  planShards,
  specFilesOnDisk,
} from "../e2e/shard-plan.mjs";

const times: Record<string, [number, number]> = JSON.parse(
  readFileSync(new URL("../e2e/shard-times.json", import.meta.url), "utf8"),
).files;

test("every file lands on exactly one shard and the measured run balances within 5%", () => {
  const counts = new Map(Object.entries(times).map(([file, [, tests]]) => [file, tests]));
  const plan = planShards(counts, times, 6);
  const placed = plan.flatMap((shard) => shard.files);
  assert.equal(placed.length, counts.size);
  assert.deepEqual([...placed].sort(), [...counts.keys()].sort());
  const loads = plan.map((shard) => shard.ms);
  assert.ok(Math.max(...loads) / Math.min(...loads) < 1.05, `loads ${loads.map((ms) => (ms / 60000).toFixed(1))}`);
});

test("the plan is the same on every call, whatever the list order", () => {
  const entries = Object.entries(times).map(([file, [, tests]]) => [file, tests] as [string, number]);
  const a = planShards(new Map(entries), times, 6);
  const b = planShards(new Map([...entries].reverse()), times, 6);
  assert.deepEqual(a, b);
});

test("weights: measured time scaled by test count; a new file by the mean time per test", () => {
  const table: Record<string, [number, number]> = { "a.spec.mjs": [60_000, 10], "b.spec.mjs": [20_000, 10] };
  const plan = planShards(new Map([["a.spec.mjs", 20], ["b.spec.mjs", 10], ["new.spec.mjs", 4]]), table, 3);
  const weight = (file: string) => plan.find((shard) => shard.files.includes(file))!.ms;
  assert.equal(weight("a.spec.mjs"), 120_000, "twice the tests, twice the time");
  assert.equal(weight("b.spec.mjs"), 20_000);
  assert.equal(weight("new.spec.mjs"), 16_000, "4 tests × 4 s mean");
});

test("listedFiles counts tests per file over nested suites and projects", () => {
  const spec = (file: string, n: number) => ({ file, tests: Array.from({ length: n }, () => ({})) });
  const report = {
    suites: [
      { specs: [spec("regression/a.spec.mjs", 2)], suites: [{ specs: [spec("regression\\b.spec.mjs", 1)] }] },
      { specs: [spec("regression/a.spec.mjs", 1)] },
    ],
  };
  assert.deepEqual([...listedFiles(report)], [["regression/a.spec.mjs", 3], ["regression/b.spec.mjs", 1]]);
});

test("filePattern matches only that file, with either separator", () => {
  const re = new RegExp(filePattern("regression/a7-controls.spec.mjs"));
  assert.ok(re.test("/home/runner/work/web/e2e/regression/a7-controls.spec.mjs"));
  assert.ok(re.test("C:\\wt\\e2e\\regression\\a7-controls.spec.mjs"));
  assert.ok(!re.test("/e2e/regression/xa7-controls.spec.mjs"));
  assert.ok(!re.test("/e2e/regression/a7-controls.spec.mjs.bak"));
  assert.ok(!re.test("/e2e/regression/a7-controlsXspec.mjs"));
});

test("coverage: every spec file on disk is run once, by a shard or a serial project", () => {
  const shardListed = new Map([["regression/a.spec.mjs", 2], ["regression/b.spec.mjs", 1]]);
  const serialListed = new Map([["regression/solo.spec.mjs", 1]]);
  const disk = ["regression/a.spec.mjs", "regression/b.spec.mjs", "regression/solo.spec.mjs"];
  const plan = planShards(shardListed, {}, 2);
  assert.deepEqual(coverageProblems(disk, shardListed, serialListed, plan), []);
  // A spec file nobody lists (a testIgnore mistake) is lost.
  assert.deepEqual(coverageProblems([...disk, "regression/lost.spec.mjs"], shardListed, serialListed, plan), [
    "regression/lost.spec.mjs: a spec file no shard or serial project runs",
  ]);
  // A listed file the plan dropped, or placed twice.
  const dropped = [{ files: ["regression/a.spec.mjs"] }, { files: [] }];
  assert.deepEqual(coverageProblems(disk, shardListed, serialListed, dropped), [
    "regression/b.spec.mjs: listed but on no shard",
    "regression/b.spec.mjs: a spec file no shard or serial project runs",
  ]);
  const twice = [{ files: ["regression/a.spec.mjs", "regression/b.spec.mjs"] }, { files: ["regression/a.spec.mjs"] }];
  assert.deepEqual(coverageProblems(disk, shardListed, serialListed, twice), ["regression/a.spec.mjs: on 2 shards"]);
  // A serial file that a shard also runs.
  assert.deepEqual(
    coverageProblems(disk, new Map([...shardListed, ["regression/solo.spec.mjs", 1]]), serialListed, [
      { files: ["regression/a.spec.mjs", "regression/solo.spec.mjs"] },
      { files: ["regression/b.spec.mjs"] },
    ]),
    ["regression/solo.spec.mjs: run by a shard and by a serial project"],
  );
});

test("specFilesOnDisk finds the spec files under smoke/ and regression/", () => {
  const files = specFilesOnDisk();
  assert.ok(files.includes("regression/a7-controls.spec.mjs"));
  assert.ok(files.includes("smoke/market.spec.mjs"));
  assert.ok(files.every((file) => /^(smoke|regression)\/.+\.spec\.mjs$/.test(file)));
});
