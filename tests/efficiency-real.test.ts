import assert from "node:assert/strict";
import test from "node:test";
import { arkGridRealView, braceletRealView } from "../lib/character/efficiency-real";

const arkOk = {
  status: "OK" as const,
  reasonCode: null,
  reason: null,
  percent: 4.67,
  optionsPercent: 3.21,
  pointsPercent: 1.41,
  options: [
    { name: "공격력", level: 28, inGamePercent: 1.02, percent: 0.99 },
    { name: "보스 피해", level: 4, inGamePercent: null, percent: null },
  ],
  series: [
    { series: "질서", percent: 2.66, optionsPercent: 1.8, pointsPercent: 0.85, options: [] },
    { series: "혼돈", percent: null, optionsPercent: null, pointsPercent: null, options: [] },
  ],
  ruleVersion: "ark-grid-real-v1",
};
const arkUnsupported = (reasonCode: string) => ({
  ...arkOk,
  status: "UNSUPPORTED" as const,
  reasonCode,
  percent: null,
  optionsPercent: null,
  pointsPercent: null,
  options: [],
  series: [],
});

test("아크 그리드 실 효율: total, parts, series with a value, option lines", () => {
  assert.deepEqual(arkGridRealView(arkOk, true), {
    state: "ready",
    total: "+4.67%",
    parts: "젬 옵션 +3.21% · 코어 포인트 +1.41%",
    series: [{ label: "질서", percent: "+2.66%" }],
    lines: [
      { name: "공격력", level: 28, percent: "+0.99%" },
      { name: "보스 피해", level: 4, percent: null },
    ],
  });
});

test("아크 그리드 실 효율: no grid is 0% (P3), a grid not worked out is '준비 중', not sent is hidden", () => {
  // PM-프론트 P3: a character with no ark grid reads "0% · 아크 그리드 없음".
  assert.deepEqual(arkGridRealView(arkUnsupported("UNAVAILABLE"), false), { state: "none" });
  for (const code of ["INPUT_PENDING", "ROLE_UNKNOWN", "UNAVAILABLE", "A_CODE_FROM_LATER"])
    assert.deepEqual(arkGridRealView(arkUnsupported(code), true), { state: "pending" }, code);
  assert.deepEqual(arkGridRealView({ ...arkOk, percent: Number.NaN }, true), { state: "pending" });
  assert.deepEqual(arkGridRealView(null, true), { state: "hidden" });
});

const braceletOk = {
  status: "OK" as const,
  reasonCode: null,
  reason: null,
  role: "DEALER" as const,
  percent: 11.3,
  devilDamagePercent: 14.08,
  ruleVersion: "bracelet-real-v1",
};

test("팔찌 실 효율: two decimals, the 악마 피해 value for a dealer, grades only for a supporter", () => {
  assert.deepEqual(braceletRealView(braceletOk), { state: "ready", percent: "+11.30%", devil: "+14.08%" });
  assert.deepEqual(braceletRealView({ ...braceletOk, devilDamagePercent: null }), { state: "ready", percent: "+11.30%", devil: null });
  // The supporter's value comes whole; the screen shows grades only (PM-프론트).
  assert.deepEqual(braceletRealView({ ...braceletOk, role: "SUPPORT", percent: 13.47857142857143, devilDamagePercent: null }), { state: "grades" });
  assert.deepEqual(braceletRealView({ ...braceletOk, status: "UNSUPPORTED", reasonCode: "INPUT_PENDING", role: null, percent: null, devilDamagePercent: null }), { state: "pending" });
  assert.deepEqual(braceletRealView(null), { state: "hidden" });
});
