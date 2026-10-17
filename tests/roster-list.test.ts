import assert from "node:assert/strict";
import test from "node:test";
import {
  classMix,
  levelBands,
  maskName,
  powerByName,
  powerSummary,
  rosterStats,
  rosterSummary,
  shares,
  sixBasis,
  sixMen,
  sortSiblings,
  viewOfRefresh,
} from "../lib/character/roster-list";
import { isRosterPowerEnvelope, isRosterPowerRefreshEnvelope } from "../lib/character/roster-power";

const roster = [
  { characterName: "다람쥐", characterLevel: 60, itemLevel: 1690 },
  { characterName: "가나", characterLevel: 70, itemLevel: 1750.5 },
  { characterName: "바다", characterLevel: 65, itemLevel: 1640 },
  { characterName: "나무", characterLevel: 70, itemLevel: 1720 },
  { characterName: "라온", characterLevel: 55, itemLevel: 1680 },
  { characterName: "마루", characterLevel: 50, itemLevel: 1600 },
  { characterName: "사과", characterLevel: 40, itemLevel: 1500 },
  { characterName: "아이", characterLevel: 20, itemLevel: null },
];

test("roster sorts: item level, character level (ties keep the list order), Korean name order", () => {
  assert.deepEqual(sortSiblings(roster, "itemLevel").map((s) => s.characterName).slice(0, 4), ["가나", "나무", "다람쥐", "라온"]);
  assert.deepEqual(sortSiblings(roster, "characterLevel").map((s) => s.characterName).slice(0, 3), ["가나", "나무", "바다"]);
  assert.deepEqual(sortSiblings(roster, "name").map((s) => s.characterName).slice(0, 3), ["가나", "나무", "다람쥐"]);
  assert.equal(roster[0].characterName, "다람쥐", "the input stays as it was");
});

test("six-man average of the six highest item levels; 1,680+ count and sum", () => {
  // 1750.5 + 1720 + 1690 + 1680 + 1640 + 1600 = 10080.5 → ÷6 = 1680.08
  assert.deepEqual(rosterSummary(roster), { sixAverage: 1680.08, sixCount: 6, sixServer: null, highCount: 4, highSum: 6840.5 });
  // Fewer than six still ÷ 6, as the ranking (api #530): (1690 + 1750.5) ÷ 6 = 573.42.
  assert.deepEqual(rosterSummary(roster.slice(0, 2)), { sixAverage: 573.42, sixCount: 2, sixServer: null, highCount: 2, highSum: 3440.5 });
  assert.deepEqual(rosterSummary([]), { sixAverage: null, sixCount: 0, sixServer: null, highCount: 0, highSum: 0 });
});

test("식스맨 is on the representative's server only, ties by name (api #530)", () => {
  const spread = [
    { characterName: "카1", serverName: "카단", itemLevel: 1700 },
    { characterName: "루1", serverName: "루페온", itemLevel: 1950 },
    { characterName: "루2", serverName: "루페온", itemLevel: 1940 },
    { characterName: "카2", serverName: "카단", itemLevel: 1690 },
    { characterName: "루3", serverName: "루페온", itemLevel: 1930 },
  ];
  // The highest is on 루페온: its three only, (1950 + 1940 + 1930) ÷ 6 = 970.
  assert.deepEqual(sixMen(spread).map((s) => s.characterName), ["루1", "루2", "루3"]);
  assert.equal(rosterSummary(spread).sixAverage, 970);
  assert.equal(rosterSummary(spread).sixServer, "루페온");
  // The 1,680+ count stays the whole roster's.
  assert.equal(rosterSummary(spread).highCount, 5);
  const tied = [7, 6, 5, 4, 3, 2, 1].map((n) => ({ characterName: `이름${n}`, serverName: "아만", itemLevel: 1700 }));
  assert.deepEqual(sixMen(tied).map((s) => s.characterName), ["이름1", "이름2", "이름3", "이름4", "이름5", "이름6"]);
});

test("six basis wording: 6 by its mean, fewer by the sum ÷ 6", () => {
  assert.equal(sixBasis(6, "평균"), "아이템 레벨 상위 6명 평균");
  assert.equal(sixBasis(6, "기준"), "아이템 레벨 상위 6명 기준");
  assert.equal(sixBasis(3, "평균"), "아이템 레벨 상위 3명 합 ÷ 6");
});

test("hidden names keep the first letter and a fixed two stars", () => {
  assert.equal(maskName("목캐릭터A"), "목**");
  assert.equal(maskName("버서커로아원정대"), "버**");
  assert.equal(maskName("🐙문어"), "🐙**");
});

test("roster numbers: count, mean, median, highest, lowest", () => {
  const roster = [1770, 1720, 1640, 1585, 915].map((itemLevel, i) => ({ characterName: `이름${i}`, itemLevel }));
  assert.deepEqual(rosterStats(roster), { count: 5, average: 1526, median: 1640, max: 1770, min: 915 });
  assert.equal(rosterStats(roster.slice(0, 4)).median, 1680);
  assert.deepEqual(rosterStats([]), { count: 0, average: null, median: null, max: null, min: null });
});

test("shares add up to exactly 100.0, biggest first", () => {
  const three = shares([{ label: "가", count: 1 }, { label: "나", count: 1 }, { label: "다", count: 1 }]);
  assert.deepEqual(three.map((s) => s.percent), [33.4, 33.3, 33.3]);
  assert.equal(Math.round(three.reduce((a, s) => a + s.percent, 0) * 10), 1000);
  const mix = classMix([
    { characterName: "a", className: "블레이드", itemLevel: 1700 },
    { characterName: "b", className: "리퍼", itemLevel: 1700 },
    { characterName: "c", className: "블레이드", itemLevel: 1700 },
  ]);
  assert.deepEqual(mix, [
    { label: "블레이드", count: 2, percent: 66.7 },
    { label: "리퍼", count: 1, percent: 33.3 },
  ]);
});

test("level bands keep high-to-low order and skip empty bands", () => {
  const bands = levelBands([1785, 1770, 1700, 1650, 1500].map((itemLevel, i) => ({ characterName: `이름${i}`, itemLevel })));
  assert.deepEqual(bands.map((b) => [b.label, b.count]), [["1780+", 1], ["1760", 1], ["1700", 1], ["1640", 1], ["1640 미만", 1]]);
  assert.equal(Math.round(bands.reduce((a, b) => a + b.percent, 0) * 10), 1000);
});

// L19: combat power records joined by name.
const item = (characterName: string, itemLevel: number, combatPower: number | null) => ({
  characterName,
  serverName: "아만",
  className: "바드",
  itemLevel,
  combatPower,
  combatPowerObservedAt: combatPower == null ? null : "2026-10-12T03:00:00Z",
  bestCombatPower: combatPower,
});
const power = {
  items: [item("다람쥐", 1690, 2100.5), item("가나", 1750.5, 3000), item("바다", 1640, null), item("나무", 1720, 2950.25), item("라온", 1680, null)],
  missingCount: 2,
  refreshAvailableAt: null,
};

test("combat power sort: highest first, no record at the bottom in item level order", () => {
  const records = powerByName(power);
  assert.deepEqual(
    sortSiblings(roster.slice(0, 5), "combatPower", records).map((s) => s.characterName),
    ["가나", "나무", "다람쥐", "라온", "바다"],
  );
  // Without records (loading or failed) it is the item level order.
  assert.deepEqual(
    sortSiblings(roster.slice(0, 5), "combatPower").map((s) => s.characterName),
    sortSiblings(roster.slice(0, 5), "itemLevel").map((s) => s.characterName),
  );
});

test("combat power six-man: the item level six ÷ 6, unknown while one at 1,640+ has no record (api #530)", () => {
  // 라온 1680 and 바다 1640 are in the six without a record: unknown, not a lower mean.
  const summary = powerSummary(roster.slice(0, 5), powerByName(power));
  assert.deepEqual(summary, { count: 5, recorded: 3, sixAverage: null, sixCount: 5, sixMissing: 2, total: 8050.75 });
  assert.equal(powerSummary(roster, new Map()).sixAverage, null);
  // All five recorded: (3000 + 2950.25 + 2100.5 + 1500 + 1200) ÷ 6 = 1791.79.
  const filled = powerByName({
    ...power,
    items: power.items.map((i) => (i.combatPower == null ? { ...i, combatPower: i.itemLevel === 1680 ? 1500 : 1200 } : i)),
  });
  assert.equal(powerSummary(roster.slice(0, 5), filled).sixAverage, 1791.79);
  // A higher combat power outside the item level six does not count.
  const strong = new Map(filled);
  strong.set("사과", { combatPower: 9999, observedAt: null, bestCombatPower: null });
  assert.equal(powerSummary(roster.slice(0, 7), strong).sixAverage, powerSummary(roster.slice(0, 6), strong).sixAverage);
  // One below 1,640 without a record counts as nothing, the mean still ÷ 6.
  const low = [{ characterName: "가나", itemLevel: 1750.5 }, { characterName: "마루", itemLevel: 1600 }];
  assert.equal(powerSummary(low, powerByName(power)).sixAverage, 500);
});

test("refill result becomes the view with the missing count from its items", () => {
  const view = viewOfRefresh({ items: power.items, fetched: 0, remaining: 3, refreshAvailableAt: null });
  assert.equal(view.missingCount, 2);
  assert.equal(view.refreshAvailableAt, null);
});

test("roster combat power envelopes follow the contract", () => {
  const ok = { code: "CHARACTER_ROSTER_COMBAT_POWER_SUCCESS", message: "ok", data: power };
  assert.equal(isRosterPowerEnvelope(ok), true);
  assert.equal(isRosterPowerEnvelope({ ...ok, data: { ...power, items: [{ ...power.items[0], combatPower: -1 }] } }), false);
  assert.equal(isRosterPowerEnvelope({ ...ok, data: { ...power, refreshAvailableAt: "not a time" } }), false);
  const refreshed = {
    code: "CHARACTER_ROSTER_COMBAT_POWER_REFRESH_SUCCESS",
    message: "ok",
    data: { items: power.items, fetched: 2, remaining: 0, refreshAvailableAt: "2026-10-12T03:10:00Z" },
  };
  assert.equal(isRosterPowerRefreshEnvelope(refreshed), true);
  assert.equal(isRosterPowerRefreshEnvelope({ ...refreshed, code: "CHARACTER_ROSTER_COMBAT_POWER_SUCCESS" }), false);
});

test("records carry the highest combat power seen; none is null like no record (B5)", () => {
  const records = powerByName({
    items: [{ ...item("가나", 1750.5, 3000), bestCombatPower: 3210.5 }, { ...item("바다", 1640, null), bestCombatPower: null }],
    missingCount: 1,
    refreshAvailableAt: null,
  });
  assert.equal(records.get("가나")?.bestCombatPower, 3210.5);
  assert.equal(records.get("바다")?.bestCombatPower, null);
});
