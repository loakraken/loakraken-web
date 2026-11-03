import { test } from "node:test";
import assert from "node:assert/strict";
import { podiumTop } from "../lib/stats/podium";

const rows = (...ranks: (number | null)[]) => ranks.map((rank, i) => ({ rank, name: `r${i}` }));
const top = (...ranks: (number | null)[]) => podiumTop(rows(...ranks)).map((row) => `${row.name}:${row.rank}`);

test("ties fill the podium in table order and keep their real ranks", () => {
  assert.deepEqual(top(1, 1, 3, 4), ["r0:1", "r1:1", "r2:3"]);
  assert.deepEqual(top(1, 2, 2, 4), ["r0:1", "r1:2", "r2:2"]);
  assert.deepEqual(top(1, 1, 1, 4), ["r0:1", "r1:1", "r2:1"]);
  assert.deepEqual(top(1, 2, 3, 4), ["r0:1", "r1:2", "r2:3"]);
});

test("short lists show what exists; unranked rows and none at all leave it empty", () => {
  assert.deepEqual(top(1, 2), ["r0:1", "r1:2"]);
  assert.deepEqual(top(1), ["r0:1"]);
  assert.deepEqual(top(1, 2, null, null), ["r0:1", "r1:2"]);
  assert.deepEqual(top(null, null, null), []);
  assert.deepEqual(top(), []);
});
