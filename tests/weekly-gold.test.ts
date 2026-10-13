import assert from "node:assert/strict";
import test from "node:test";
import { weeklyGold } from "../lib/character/weekly-gold";
import { addCharacters, emptyState, rosterSummary } from "../lib/tools/homework";

const sibling = (characterName: string, itemLevel: number | null, serverName = "아만") => ({
  characterName,
  serverName,
  className: "블레이드",
  itemLevel,
});

test("weekly gold: top six of the server, three best raids each (values checked against a reference roster)", () => {
  const roster = [
    sibling("가", 1770),
    sibling("나", 1725),
    sibling("다", 1705),
    sibling("라", 1585),
    sibling("마", 1580),
    sibling("바", 1560),
    sibling("사", 1500),
    sibling("다른서버", 1780, "루페온"),
  ];
  const gold = weeklyGold(roster, "아만")!;
  assert.equal(gold.rows.length, 6);
  assert.deepEqual(
    gold.rows.map((row) => row.name),
    ["가", "나", "다", "라", "마", "바"],
  );
  // The three top characters match the reference roster exactly
  // (166,000 / 110,000 / 84,000; bound 50,000 / 56,000 / 57,000).
  assert.deepEqual(
    gold.rows.slice(0, 3).map((row) => [row.gold, row.bound]),
    [
      [166000, 50000],
      [110000, 56000],
      [84000, 57000],
    ],
  );
  assert.equal(gold.rows[0].raids.length, 3);
  assert.equal(gold.total, gold.rows.reduce((sum, row) => sum + row.gold, 0));
  assert.equal(gold.bound, gold.rows.reduce((sum, row) => sum + row.bound, 0));
  assert.equal(gold.tradable, gold.total - gold.bound);
  assert.equal(gold.unknownGates, 0);
});

test("weekly gold equals the homework tool's automatic setup for the same characters", () => {
  const roster = [sibling("가", 1770), sibling("나", 1725), sibling("다", 1705), sibling("라", 1640)];
  const tool = rosterSummary(
    addCharacters(
      emptyState(0),
      roster.map((s) => ({ name: s.characterName, server: s.serverName, className: s.className, itemLevel: s.itemLevel! })),
    ),
  );
  const gold = weeklyGold(roster, "아만")!;
  assert.equal(gold.total, tool.possible);
  assert.equal(gold.bound, tool.possibleBound);
});

test("weekly gold: other servers and unknown item levels do not count; no known level gives null", () => {
  const gold = weeklyGold([sibling("가", 1770), sibling("나", null), sibling("다", 1760, "루페온")], "아만")!;
  assert.deepEqual(
    gold.rows.map((row) => row.name),
    ["가"],
  );
  assert.equal(weeklyGold([sibling("나", null)], "아만"), null);
  assert.equal(weeklyGold([sibling("가", 1770)], "루페온"), null);
});

test("weekly gold: a character below every gold raid earns nothing", () => {
  const gold = weeklyGold([sibling("가", 1400)], "아만")!;
  assert.deepEqual(gold.rows[0].raids, []);
  assert.equal(gold.rows[0].gold, 0);
  assert.equal(gold.total, 0);
});
