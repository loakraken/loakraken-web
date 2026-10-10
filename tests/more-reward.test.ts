import assert from "node:assert/strict";
import test from "node:test";
import {
  INPUT_MATERIALS,
  MORE_DATA,
  boundGoldFor,
  checkMoreData,
  exchangeValue,
  gateResult,
  priceNames,
} from "../lib/tools/more-reward";
import { RAID_DATA } from "../lib/tools/raid-rewards";
import { MAX_PRICE_NAMES } from "../lib/market/model";

test("more-reward data passes its checks and matches the official reward table", () => {
  assert.deepEqual(checkMoreData(), []);
  // Notice 13307 costs are also in raid-rewards.json; both files must agree.
  const byLabel: Record<string, string> = { 하드: "HARD", 노말: "NORMAL", "노말 · 싱글": "NORMAL", 나이트메어: "NIGHTMARE" };
  let compared = 0;
  for (const raid of MORE_DATA.raids) {
    const table = RAID_DATA.raids.find((r) => r.id === raid.id);
    for (const mode of raid.modes) {
      const tableMode = table?.modes.find((m) => m.difficulty === byLabel[mode.label]);
      for (const gate of mode.gates) {
        const official = tableMode?.gates.find((g) => g.gate === gate.gate)?.moreCost;
        if (official == null) continue;
        assert.equal(gate.cost, official, `${raid.id} ${mode.label} ${gate.gate}`);
        compared++;
      }
    }
  }
  assert.ok(compared >= 20, `compared ${compared} gates`);
  assert.ok(priceNames().length <= MAX_PRICE_NAMES, "one price request");
});

test("gate result: fixed items + entered materials − cost, unpriced items count 0", () => {
  const gate = MORE_DATA.raids.find((r) => r.id === "serka")!.modes[1].gates[0];
  const prices: Record<string, number> = { "운명의 파괴석 결정": 9.04, "운명의 파편": 0.091 };
  const result = gateResult(
    gate,
    { "운명의 파괴석 결정": 750, "운명의 파편": 17500, "운명의 수호석": -3 },
    (name) => prices[name] ?? null,
    null,
    false,
  );
  assert.equal(result.cost, 5600);
  assert.equal(result.paid, 5600);
  assert.ok(Math.abs(result.value - (750 * 9.04 + 17500 * 0.091)) < 1e-9);
  assert.ok(Math.abs(result.gain - (result.value - 5600)) < 1e-9);
  assert.deepEqual(result.unpriced.sort(), ["고통의 가시", "아크 그리드 코어"].sort());
  assert.equal(result.hasInput, true);
  assert.equal(result.lines.some((l) => l.name === "운명의 수호석"), false, "negative input ignored");
  assert.equal(gateResult(gate, {}, () => null, null, false).hasInput, false);
});

test("bound-gold option leaves out the part bound gold pays (notice 13148)", () => {
  const prologue = MORE_DATA.raids.find((r) => r.id === "kazeros-prologue")!;
  const normal = prologue.modes.find((m) => m.label === "노말 · 싱글")!;
  const bound = boundGoldFor("kazeros-prologue", "노말 · 싱글", 1);
  assert.equal(bound, 1900, "서막 노말 1관문 is all bound gold");
  const result = gateResult(normal.gates[0], {}, () => 0, bound, true);
  assert.equal(result.paid, 0);
  const hard = prologue.modes.find((m) => m.label === "하드")!;
  // 서막 하드 is half bound since notice 13416: 1,100 bound covers the 720 cost.
  assert.equal(boundGoldFor("kazeros-prologue", "하드", 1), 1100);
  assert.equal(gateResult(hard.gates[0], {}, () => 0, 1100, true).paid, 0);
  const belgardinHard = MORE_DATA.raids.find((r) => r.id === "belgardin")!.modes.find((m) => m.label === "하드")!;
  assert.equal(boundGoldFor("belgardin", "하드", 1), 0);
  assert.equal(gateResult(belgardinHard.gates[0], {}, () => 0, 0, true).paid, 8000);
  assert.equal(boundGoldFor("horizon-cathedral", "3단계", 1), 20000, "all bound");
  // 노말 · 싱글 rows need both modes to agree (PM-프론트 #261 P2).
  assert.equal(boundGoldFor("kazeros-act1", "노말 · 싱글", 1), 1750, "both half bound (notices 13307·13416)");
  assert.equal(boundGoldFor("kazeros-act4", "노말 · 싱글", 1), null, "single has no value");
  assert.equal(boundGoldFor("serka", "노말 · 싱글", 1), 6500, "no single mode in the table");
  assert.equal(INPUT_MATERIALS.length, 7);
});

test("은총의 파편 is worth its fixed box contents ÷ 60 (계산 검증 18:12)", () => {
  // 일로아 02:30 prices: 파편 0.0913, 파괴석 결정 9.04, 수호석 결정 1.91, 위대한 돌파석 33.
  const prices: Record<string, number> = {
    "운명의 파편": 0.0913,
    "운명의 파괴석 결정": 9.04,
    "운명의 수호석 결정": 1.91,
    "위대한 운명의 돌파석": 33,
  };
  const value = exchangeValue("은총의 파편", (n) => prices[n] ?? null)!;
  assert.ok(Math.abs(value - (22500 * 0.0913 + 2000 * 9.04 + 4000 * 1.91 + 60 * 33) / 60) < 1e-9);
  assert.ok(Math.abs(value - 497.33) < 2, `${value} ≈ 일로아 497.33`);
  assert.equal(exchangeValue("은총의 파편", () => null), null, "a missing content price → no value");
  assert.equal(exchangeValue("고통의 가시", () => 1), null, "choice recipes stay user input");
});
