import assert from "node:assert/strict";
import test from "node:test";
import {
  CHEATSHEET_DATA,
  cheatSheetFor,
  checkCheatSheet,
  type CheatSheetData,
} from "../lib/tools/raid-cheatsheet";

test("cheat sheet data is internally consistent and matches raid-rewards", () => {
  assert.deepEqual(checkCheatSheet(CHEATSHEET_DATA), []);
});

test("the first three raids are covered", () => {
  for (const id of ["kazeros-final", "serka", "belgardin"])
    assert.ok(
      CHEATSHEET_DATA.raids.some((r) => r.raidId === id),
      `${id} missing`,
    );
  assert.ok(cheatSheetFor("kazeros-final", "NORMAL"));
  assert.equal(cheatSheetFor("valtan", "NORMAL"), null);
});

test("every source is kept with a url and check date", () => {
  for (const source of Object.values(CHEATSHEET_DATA.sources)) {
    assert.match(source.url, /^https:\/\//);
    assert.match(source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("the checker catches the mistakes it is meant to catch", () => {
  const broken = structuredClone(CHEATSHEET_DATA) as CheatSheetData;
  const gate = broken.raids[0].difficulties[0].gates[0];
  const pattern = gate.patterns[0];
  pattern.sources = ["nowhere"];
  pattern.description = "인벤 공략 기준이며 실제와 다를 수 있음";
  pattern.hpBars = { from: 10, to: 20 };
  gate.patterns.push(structuredClone(gate.patterns[1]));
  broken.raids[0].difficulties[0].gates.push({ ...gate, gate: 9 });
  broken.raids.push({ raidId: "no-such-raid", difficulties: [] });
  broken.sources["other-1"] = { title: "블로그", url: "https://example.com", checkedAt: "2026-10-11", kind: "OTHER" };
  broken.raids[0].difficulties[0].gates[0].patterns[1].sources = ["other-1"];
  const problems = checkCheatSheet(broken);
  for (const expected of [
    "unknown source",
    "names a source or hedges",
    "hp bars from below to",
    "duplicate pattern id",
    "gate out of order",
    "not in raid-rewards",
    "only one OTHER source",
  ])
    assert.ok(problems.some((p) => p.includes(expected)), expected);
});

test("an empty gate must say why", () => {
  const broken = structuredClone(CHEATSHEET_DATA) as CheatSheetData;
  const gate = broken.raids[0].difficulties[0].gates[0];
  gate.patterns = [];
  gate.missingReason = null;
  assert.ok(checkCheatSheet(broken).some((p) => p.includes("no patterns and no missingReason")));
});
