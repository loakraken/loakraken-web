import assert from "node:assert/strict";
import test from "node:test";
import { panelSave, raidChoices, replaceCharacter, weeklyGold, withRaid } from "../lib/character/weekly-gold";
import { addCharacters, emptyState, modeOf, rosterSummary, weekStart, type HomeworkState } from "../lib/tools/homework";
import { savedState } from "../lib/tools/homework-store";

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

// #14: the panel shows (and changes) the homework tool's saved state.
const roster6 = [
  sibling("가", 1770),
  sibling("나", 1725),
  sibling("다", 1705),
  sibling("라", 1585),
  sibling("마", 1580),
  sibling("바", 1560),
  sibling("사", 1500),
];

test("weekly gold: nothing saved gives the automatic setup, and its state is what a first change saves", () => {
  const gold = weeklyGold(roster6, "아만")!;
  assert.ok(gold.rows.every((row) => row.on));
  assert.equal(gold.state.characters.length, 7);
  assert.equal(gold.goldFull, true);
});

test("weekly gold: a character saved with gold off keeps its row at 0 and leaves the totals", () => {
  const before = weeklyGold(roster6, "아만")!;
  const off = replaceCharacter(before.state, { ...before.rows[0].character, gold: false });
  const gold = weeklyGold(roster6, "아만", 0, off)!;
  assert.deepEqual(gold.rows.map((row) => row.name), ["가", "나", "다", "라", "마", "바"]);
  assert.equal(gold.rows[0].on, false);
  assert.equal(gold.rows[0].gold, 0);
  assert.equal(gold.total, before.total - before.rows[0].gold);
  assert.equal(gold.goldFull, false);
});

test("weekly gold: a raid turned off or on changes that character's gold; a fourth raid pays nothing", () => {
  const before = weeklyGold(roster6, "아만")!;
  const first = before.rows[0].character;
  const choices = raidChoices(first);
  assert.equal(choices.filter((c) => c.on).length, 3);
  const dropped = withRaid(first, choices[0], false);
  const lower = weeklyGold(roster6, "아만", 0, replaceCharacter(before.state, dropped))!;
  assert.ok(lower.rows[0].gold < before.rows[0].gold);
  assert.equal(lower.rows[0].character.raids.length, 2);
  // Turned back on, it goes last; with three already on, a fourth one pays nothing.
  const extra = raidChoices(first).find((c) => !c.on)!;
  const four = withRaid(first, extra, true);
  const same = weeklyGold(roster6, "아만", 0, replaceCharacter(before.state, four))!;
  assert.equal(same.rows[0].character.raids.length, 4);
  assert.equal(same.rows[0].gold, before.rows[0].gold);
});

test("weekly gold: gold characters saved on another server count toward the six, with the reason shown", () => {
  // PM 총괄 11-09 (i): one rule on both screens, the homework tool's six over every server.
  const other = addCharacters(emptyState(0), [
    { name: "루1", server: "루페온", className: "블레이드", itemLevel: 1700 },
    { name: "루2", server: "루페온", className: "블레이드", itemLevel: 1700 },
  ]);
  const gold = weeklyGold(roster6, "아만", 0, other)!;
  // Six rows still, the last two without gold (the roster's six are used).
  assert.equal(gold.rows.length, 6);
  assert.deepEqual(gold.rows.map((row) => row.on), [true, true, true, true, false, false]);
  assert.equal(gold.goldFull, true);
  assert.equal(gold.elsewhere, 2);
  assert.equal(gold.blocked, true);
});

test("weekly gold: the raid list keeps its order when a raid is turned off or on (A7)", () => {
  const first = weeklyGold(roster6, "아만")!.rows[0].character;
  const before = raidChoices(first).map((c) => c.raidId);
  const dropped = withRaid(first, raidChoices(first)[0], false);
  assert.deepEqual(raidChoices(dropped).map((c) => c.raidId), before);
  assert.equal(raidChoices(dropped)[0].on, false);
});

test("weekly gold: read with this week, a ticked 더보기 lowers the gold as in the homework tool (codex P2)", () => {
  const week = weekStart(Date.now());
  const before = weeklyGold(roster6, "아만", week)!;
  const first = before.rows[0].character;
  const i = first.raids.findIndex((plan) => modeOf(plan)?.gates.some((g) => g.moreCost));
  assert.ok(i >= 0, "a planned raid with a 더보기");
  const gate = modeOf(first.raids[i])!.gates.findIndex((g) => g.moreCost);
  const raids = first.raids.map((plan, j) => (j === i ? { ...plan, more: plan.more.map((v, k) => (k === gate ? true : v)) } : plan));
  const saved = replaceCharacter({ ...before.state, week }, { ...first, raids });
  const text = JSON.stringify(saved);
  const cost = modeOf(first.raids[i])!.gates[gate].moreCost!;
  const now = weeklyGold(roster6, "아만", week, savedState(text, week))!;
  assert.equal(now.rows[0].gold, before.rows[0].gold - cost);
  // Read as another week, the 더보기 would be reset and the gold overstated.
  const stale = weeklyGold(roster6, "아만", 0, savedState(text, 0))!;
  assert.equal(stale.rows[0].gold, before.rows[0].gold);
});

// #1466 계산 검증 P1 (1): a 7th character given gold in the homework tool counts in the
// panel too (the rule is 6 per 원정대; here 6 are on, one of them outside the default six).
test("weekly gold: a gold-on character outside the default six is in the total and listed, read-only", () => {
  const roster = ["가", "나", "다", "라", "마", "바", "사"].map((name, i) => sibling(name, 1770 - i * 20));
  const picked = roster.map((s) => ({ name: s.characterName, server: s.serverName, className: s.className, itemLevel: s.itemLevel! }));
  let saved = addCharacters(emptyState(0), picked);
  const flip = (name: string, gold: boolean) => {
    const c = saved.characters.find((x) => x.name === name)!;
    saved = replaceCharacter(saved, { ...c, gold });
  };
  flip("나", false);
  flip("사", true);
  const gold = weeklyGold(roster, "아만", 0, saved)!;
  const tool = rosterSummary({ ...saved, characters: saved.characters.filter((c) => c.gold) });
  assert.equal(gold.total, tool.possible);
  assert.equal(gold.bound, tool.possibleBound);
  assert.deepEqual(
    gold.rows.map((row) => [row.name, row.on]),
    [
      ["가", true],
      ["나", false],
      ["다", true],
      ["라", true],
      ["마", true],
      ["바", true],
      ["사", true],
    ],
  );
  assert.equal(gold.rows.at(-1)!.extra, true);
  assert.ok(gold.rows.slice(0, 6).every((row) => !row.extra));
});

// #1466 계산 검증 (PM 총괄 11-09, (i)): six gold characters saved on another server leave
// this server without gold on both screens, the first view included, with the reason shown.
test("weekly gold: six gold characters saved on another server: the first view is what the homework tool gives", () => {
  const other = ["일", "이", "삼", "사", "오", "육"].map((name, i) => sibling(`루${name}`, 1700 - i, "루페온"));
  const here = [sibling("가", 1770), sibling("나", 1725), sibling("다", 1705)];
  const saved = addCharacters(
    emptyState(0),
    other.map((s) => ({ name: s.characterName, server: s.serverName, className: s.className, itemLevel: s.itemLevel! })),
  );
  assert.equal(saved.characters.filter((c) => c.gold).length, 6);
  const roster = [...other, ...here];
  const gold = weeklyGold(roster, "아만", 0, saved)!;
  assert.deepEqual(
    gold.rows.map((row) => [row.name, row.on]),
    [
      ["가", false],
      ["나", false],
      ["다", false],
    ],
  );
  // What the homework tool gives for the same characters (added its own way): nothing.
  const tool = addCharacters(saved, here.map((s) => ({ name: s.characterName, server: s.serverName, className: s.className, itemLevel: s.itemLevel! })));
  const toolHere = rosterSummary({ ...tool, characters: tool.characters.filter((c) => c.server === "아만" && c.gold) });
  assert.equal(gold.total, toolHere.possible);
  assert.equal(gold.total, 0);
  assert.equal(gold.goldFull, true);
  assert.equal(gold.elsewhere, 6);
  assert.equal(gold.blocked, true);
  // A raid change here then saves nothing that moves the total (the characters had no gold).
  const next = panelSave(roster, "아만", 0, saved, "가", (c) => withRaid(c, raidChoices(c)[0], false))!;
  assert.equal(weeklyGold(roster, "아만", 0, next)!.total, gold.total);
});

test("weekly gold: the first view equals the homework tool, and a raid toggle moves the total by that raid's gold at most", () => {
  const other = ["일", "이", "삼"].map((name, i) => sibling(`루${name}`, 1700 - i, "루페온"));
  const here = ["가", "나", "다", "라"].map((name, i) => sibling(name, 1770 - i * 10));
  const roster = [...other, ...here];
  const saved = addCharacters(
    emptyState(0),
    other.map((s) => ({ name: s.characterName, server: s.serverName, className: s.className, itemLevel: s.itemLevel! })),
  );
  const view = weeklyGold(roster, "아만", 0, saved)!;
  const tool = addCharacters(saved, here.map((s) => ({ name: s.characterName, server: s.serverName, className: s.className, itemLevel: s.itemLevel! })));
  const toolHere = rosterSummary({ ...tool, characters: tool.characters.filter((c) => c.server === "아만" && c.gold) });
  assert.equal(view.total, toolHere.possible);
  assert.deepEqual(view.rows.map((row) => row.on), [true, true, true, false]);
  for (const row of view.rows) {
    const choice = raidChoices(row.character).find((c) => c.on)!;
    const next = panelSave(roster, "아만", 0, saved, row.name, (c) => withRaid(c, choice, false))!;
    const after = weeklyGold(roster, "아만", 0, next)!;
    assert.ok(Math.abs(view.total - after.total) <= (choice.gold ?? 0), `${row.name}: ${view.total} → ${after.total}`);
  }
});
// codex #1466 P1: a panel change goes through the homework tool's own six (all servers).
test("weekly gold: panel changes never take the homework tool past six gold characters (two servers)", () => {
  const other = ["일", "이", "삼", "사"].map((name, i) => sibling(`루${name}`, 1700 - i, "루페온"));
  const here = ["가", "나", "다", "라"].map((name, i) => sibling(name, 1770 - i * 10));
  const roster = [...other, ...here];
  let saved: HomeworkState | null = addCharacters(
    emptyState(0),
    other.map((s) => ({ name: s.characterName, server: s.serverName, className: s.className, itemLevel: s.itemLevel! })),
  );
  // Before any change: two slots left, so not 0G, and the reason line is on.
  const view = weeklyGold(roster, "아만", 0, saved)!;
  assert.ok(view.total > 0);
  assert.deepEqual(view.rows.map((row) => row.on), [true, true, false, false]);
  assert.equal(view.blocked, true);
  // Every row switched off then on again, and a raid changed on each, through the panel.
  for (const s of here) {
    for (const gold of [false, true]) {
      const next = panelSave(roster, "아만", 0, saved, s.characterName, (c) => ({ ...c, gold }));
      if (next) saved = next;
    }
    const raid = panelSave(roster, "아만", 0, saved, s.characterName, (c) => withRaid(c, raidChoices(c)[0], false));
    if (raid) saved = raid;
    const goldCount = saved!.characters.filter((c) => c.gold).length;
    assert.ok(goldCount <= 6, `gold characters ${goldCount}/6 after ${s.characterName}`);
  }
  // The homework tool's own numbers stay right: its total is its gold characters' sum,
  // and with six used its own lock ('모두 썼어요') is what the panel locks too.
  const tool = rosterSummary(saved!);
  const gold = weeklyGold(roster, "아만", 0, saved)!;
  assert.equal(tool.goldCharacters, 6);
  assert.equal(gold.goldFull, true);
  const homeworkHere = rosterSummary({ ...saved!, characters: saved!.characters.filter((c) => c.server === "아만" && c.gold) });
  assert.equal(gold.total, homeworkHere.possible);
  // A locked switch saves nothing.
  const offRow = gold.rows.find((row) => !row.on)!;
  assert.equal(panelSave(roster, "아만", 0, saved, offRow.name, (c) => ({ ...c, gold: true })), null);
});

test("weekly gold: a first panel change saves this server's characters as the homework tool adds them", () => {
  const roster = [sibling("가", 1770), sibling("나", 1760), sibling("다", 1750), sibling("루", 1790, "루페온")];
  const next = panelSave(roster, "아만", 0, null, "나", (c) => withRaid(c, raidChoices(c)[0], false))!;
  const tool = addCharacters(emptyState(0), [
    { name: "가", server: "아만", className: "블레이드", itemLevel: 1770 },
    { name: "나", server: "아만", className: "블레이드", itemLevel: 1760 },
    { name: "다", server: "아만", className: "블레이드", itemLevel: 1750 },
  ]);
  assert.deepEqual(
    next.characters.map((c) => [c.name, c.gold]),
    tool.characters.map((c) => [c.name, c.gold]),
  );
});