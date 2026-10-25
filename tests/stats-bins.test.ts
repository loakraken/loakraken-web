import assert from "node:assert/strict";
import test from "node:test";
import { coarsen } from "../lib/stats/bins";

const run = (from: number, n: number, width: number) =>
  Array.from({ length: n }, (_, i) => ({ from: from + i * width, to: from + (i + 1) * width, count: i + 1 }));

test("bins: few enough stay as they are", () => {
  const bins = run(1640, 30, 5);
  assert.deepEqual(coarsen(bins), bins);
});

test("bins: a wide combat power range joins into round widths, at most 40 bars, counts kept", () => {
  const bins = run(1200, 95, 100); // 1,200 ~ 10,700 in 100s
  const out = coarsen(bins);
  assert.ok(out.length <= 40, `${out.length}`);
  assert.equal(out[0].to - out[0].from, 250); // the smallest round width that fits
  for (const bin of out) assert.equal(bin.from % 250, 0);
  assert.equal(out.reduce((a, b) => a + b.count, 0), bins.reduce((a, b) => a + b.count, 0));
  // Contiguous and in order.
  for (let i = 1; i < out.length; i++) assert.equal(out[i].from, out[i - 1].to);
});

test("bins: sparse input (empty bins left out) still lands in the right joined bin", () => {
  const out = coarsen([...run(1000, 41, 100), { from: 9000, to: 9100, count: 7 }]);
  const last = out.at(-1)!;
  assert.ok(last.from <= 9000 && 9000 < last.to);
  assert.equal(last.count, 7);
});
