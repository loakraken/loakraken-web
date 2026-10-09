import assert from "node:assert/strict";
import test from "node:test";
import {
  INPUT_MATERIALS,
  MORE_DATA,
  boundGoldFor,
  checkMoreData,
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
  assert.equal(boundGoldFor("kazeros-prologue", "하드", 1), 0);
  assert.equal(gateResult(hard.gates[0], {}, () => 0, 0, true).paid, 720);
  assert.equal(boundGoldFor("horizon-cathedral", "3단계", 1), null, "not in the reward table");
  assert.equal(INPUT_MATERIALS.length, 7);
});
