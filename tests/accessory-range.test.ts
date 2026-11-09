import { test } from "node:test";
import assert from "node:assert/strict";
import { belowRange, rangeDetail, rangePercent } from "../lib/character/accessory-range";

const stats = { polishStage: 3, mainStat: 16009, mainStatMin: 15178, mainStatMax: 17857, mainStatRangePct: 31.02 };

test("range %: two decimals as the market shows it", () => {
  assert.equal(rangePercent(stats), "31.02%");
  assert.equal(rangePercent({ ...stats, mainStatRangePct: 94.5 }), "94.50%");
  assert.equal(rangePercent({ ...stats, mainStatRangePct: 0 }), "0.00%");
});

test("range %: signed and never clamped (연마 3단계 range for every accessory)", () => {
  assert.equal(rangePercent({ ...stats, mainStatRangePct: 103.2 }), "103.20%");
  assert.equal(rangePercent({ ...stats, mainStatRangePct: -12.4 }), "−12.40%");
  assert.equal(rangePercent({ ...stats, mainStatRangePct: -100 }), "−100.00%");
  // A value that rounds to zero carries no sign.
  assert.equal(rangePercent({ ...stats, mainStatRangePct: -0.004 }), "0.00%");
});

test("below the range: only a shown negative", () => {
  assert.equal(belowRange({ ...stats, mainStatRangePct: -12.4 }), true);
  assert.equal(belowRange({ ...stats, mainStatRangePct: -0.004 }), false);
  assert.equal(belowRange(stats), false);
  assert.equal(belowRange(null), false);
});

test("range %: nothing without stats or without a %", () => {
  assert.equal(rangePercent(undefined), null);
  assert.equal(rangePercent(null), null);
  assert.equal(rangePercent({ ...stats, mainStatRangePct: null }), null);
  assert.equal(rangeDetail({ ...stats, mainStatRangePct: null }), null);
});

test("range detail: value, 연마 3단계 range and % with thousands separators", () => {
  assert.equal(rangeDetail(stats), "16,009 (연마 3단계 범위 15,178 ~ 17,857, 31.02%)");
  assert.equal(
    rangeDetail({ ...stats, mainStat: 7479, mainStatMin: 9414, mainStatMax: 11349, mainStatRangePct: -100 }),
    "7,479 (연마 3단계 범위 9,414 ~ 11,349, −100.00%)",
  );
});
