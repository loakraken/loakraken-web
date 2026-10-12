import assert from "node:assert/strict";
import test from "node:test";
import { classMix, levelBands, maskName, rosterStats, rosterSummary, shares, sortSiblings } from "../lib/character/roster-list";

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
  assert.deepEqual(rosterSummary(roster), { sixAverage: 1680.08, sixCount: 6, highCount: 4, highSum: 6840.5 });
  assert.deepEqual(rosterSummary(roster.slice(0, 2)), { sixAverage: 1720.25, sixCount: 2, highCount: 2, highSum: 3440.5 });
  assert.deepEqual(rosterSummary([]), { sixAverage: null, sixCount: 0, highCount: 0, highSum: 0 });
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
