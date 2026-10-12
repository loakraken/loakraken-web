import assert from "node:assert/strict";
import test from "node:test";
import { maskName, rosterSummary, sortSiblings } from "../lib/character/roster-list";

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
