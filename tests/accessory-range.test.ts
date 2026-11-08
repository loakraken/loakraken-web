import { test } from "node:test";
import assert from "node:assert/strict";
import { rangeDetail, rangePercent } from "../lib/character/accessory-range";

const stats = { polishStage: 3, mainStat: 16009, mainStatMin: 15178, mainStatMax: 17857, mainStatRangePct: 31.02 };

test("range %: two decimals as the market shows it", () => {
  assert.equal(rangePercent(stats), "31.02%");
  assert.equal(rangePercent({ ...stats, mainStatRangePct: 94.5 }), "94.50%");
  assert.equal(rangePercent({ ...stats, mainStatRangePct: 0 }), "0.00%");
});

test("range %: nothing without stats or outside the range", () => {
  assert.equal(rangePercent(undefined), null);
  assert.equal(rangePercent(null), null);
  assert.equal(rangePercent({ ...stats, mainStatRangePct: null }), null);
  assert.equal(rangeDetail({ ...stats, mainStatRangePct: null }), null);
});

test("range detail: value, range and % with thousands separators", () => {
  assert.equal(rangeDetail(stats), "16,009 (범위 15,178 ~ 17,857, 31.02%)");
});
