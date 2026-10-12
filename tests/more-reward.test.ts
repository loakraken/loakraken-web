import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  INPUT_MATERIALS,
  MORE_DATA,
  boundGoldFor,
  checkMoreData,
  exchangeValue,
  gateResult,
  marketNames,
  guaranteeRecipe,
  guaranteeValue,
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
  assert.ok(marketNames().length <= MAX_PRICE_NAMES, "one price request");
  // Exchange-only bound items are never on the market.
  assert.ok(!marketNames().includes("고통의 가시") && priceNames().includes("고통의 가시"));
});

test("gate result: data items (+ any typed extras) − cost, unpriced items count 0", () => {
  const gate = MORE_DATA.raids.find((r) => r.id === "serka")!.modes[1].gates[0];
  const prices: Record<string, number> = { "운명의 파괴석 결정": 9.04, "운명의 파편": 0.091 };
  const result = gateResult(gate, {}, (name) => prices[name] ?? null, null, false);
  // 세르카 하드 1관문: 파괴석 결정 750 · 파편 17,500 (계산 검증 9절).
  assert.equal(result.cost, 5600);
  assert.equal(result.paid, 5600);
  assert.ok(Math.abs(result.value - (750 * 9.04 + 17500 * 0.091)) < 1e-9);
  assert.ok(Math.abs(result.gain - (result.value - 5600)) < 1e-9);
  assert.deepEqual(
    result.unpriced.sort(),
    ["고통의 가시", "아크 그리드 코어", "운명의 수호석 결정", "위대한 운명의 돌파석"].sort(),
  );
  assert.equal(result.hasInput, false);
  const typed = gateResult(gate, { "운명의 파편": 1000, "운명의 수호석": -3 }, (name) => prices[name] ?? null, null, false);
  assert.ok(Math.abs(typed.value - result.value - 1000 * 0.091) < 1e-9);
  assert.equal(typed.lines.some((l) => l.name === "운명의 수호석"), false, "negative input ignored");
});

test("every gate carries the 46-gate quantity table (계산 검증 2026-10-11 9절)", () => {
  type Row = { raid: string; mode: string; gate: number; cost: number; items: { name: string; qty: number }[] };
  const table: Row[] = JSON.parse(
    readFileSync(new URL("./more-reward-fixtures/gates-2026-10-11.json", import.meta.url), "utf8"),
  );
  let gates = 0;
  for (const raid of MORE_DATA.raids) for (const mode of raid.modes) gates += mode.gates.length;
  assert.equal(table.length, gates);
  for (const row of table) {
    const where = `${row.raid} ${row.mode} ${row.gate}`;
    const gate = MORE_DATA.raids
      .find((r) => r.name === row.raid)
      ?.modes.find((m) => m.label === row.mode)
      ?.gates.find((g) => g.gate === row.gate);
    assert.ok(gate, where);
    assert.equal(gate.cost, row.cost, `${where} cost`);
    for (const item of row.items)
      assert.equal(gate.items.find((i) => i.name === item.name)?.qty, item.qty, `${where} ${item.name}`);
  }
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
  // 계산 검증 02:30 prices: 파편 0.0913, 파괴석 결정 9.04, 수호석 결정 1.91, 위대한 돌파석 33.
  const prices: Record<string, number> = {
    "운명의 파편": 0.0913,
    "운명의 파괴석 결정": 9.04,
    "운명의 수호석 결정": 1.91,
    "위대한 운명의 돌파석": 33,
  };
  const value = exchangeValue("은총의 파편", (n) => prices[n] ?? null)!;
  assert.ok(Math.abs(value - (22500 * 0.0913 + 2000 * 9.04 + 4000 * 1.91 + 60 * 33) / 60) < 1e-9);
  assert.ok(Math.abs(value - 497.33) < 2, `${value} ≈ 497.33 (계산 검증)`);
  assert.equal(exchangeValue("은총의 파편", () => null), null, "a missing content price → no value");
  assert.equal(exchangeValue("고통의 가시", () => 1), null, "choice recipes stay user input");
});

test("고통의 가시 is worth its minimum guarantee, never made-up odds (계산 검증 23:33)", () => {
  const prices: Record<string, number> = {
    "용암의 숨결": 515,
    "빙하의 숨결": 461,
    "운명의 파편 주머니(대)": 500,
    "위대한 운명의 돌파석": 36,
    "운명의 파괴석 결정": 9.04,
    "운명의 수호석 결정": 1.91,
  };
  const price = (name: string) => prices[name] ?? null;
  // Pouch: min(4 × 515, 12 × 461) = 2,060; box: min(…, 3 × 36 = 108, …) = 108.
  // The better recipe's minimum, ÷ 5 thorns: 412 (18:54 market, vault 더보기 자동 값 근거).
  assert.equal(guaranteeValue("고통의 가시", price), 412);
  assert.equal(guaranteeRecipe("고통의 가시", price)?.into, "고통의 재련 보조 재료 주머니");
  // A recipe with an unpriced result cannot prove its minimum and drops out.
  const noLava = (name: string) => (name === "용암의 숨결" ? null : price(name));
  assert.equal(guaranteeValue("고통의 가시", noLava), 108 / 5);
  assert.equal(guaranteeValue("고통의 가시", () => null), null);
  // 사령: pouch min(용암 5 × 515, 빙하 15 × 461) = 2,575 → ÷ 20 · ÷ 10 (계산 검증 00:09).
  assert.equal(guaranteeValue("사령의 잔영", price), 2575 / 20);
  assert.equal(guaranteeValue("죽음의 손", price), 2575 / 10);
});
