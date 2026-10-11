import assert from "node:assert/strict";
import test from "node:test";
import {
  CHEATSHEET_DATA,
  cheatSheetFor,
  checkCheatSheet,
  type CheatSheetData,
} from "../lib/tools/raid-cheatsheet";

// Shape example only: names and numbers are placeholders, not game data.
const sample = (): CheatSheetData => ({
  version: "2026-10-12",
  checkedAt: "2026-10-12",
  sources: {
    "guide-1": { title: "공략 글 1", url: "https://example.com/guide-1", checkedAt: "2026-10-12", kind: "INVEN" },
  },
  raids: [
    {
      raidId: "serka",
      difficulties: [
        {
          difficulty: "NORMAL",
          gates: [
            {
              gate: 1,
              boss: "보스 A",
              hpBars: 300,
              patterns: [
                {
                  id: "pattern-a",
                  name: "패턴 A",
                  description: "보스가 바닥에 장판을 깐다.",
                  counterplay: "장판 밖으로 나간다.",
                  hpBars: { from: 240, to: 240 },
                  sources: ["guide-1"],
                },
                {
                  id: "pattern-b",
                  name: "패턴 B",
                  description: "보스가 돌진한다.",
                  counterplay: "옆으로 피한다.",
                  hpBars: null,
                  sources: ["guide-1"],
                },
              ],
              missingReason: null,
            },
            { gate: 2, boss: "보스 B", hpBars: null, patterns: [], missingReason: "아직 조사하지 않음" },
          ],
        },
      ],
    },
  ],
});

test("cheat sheet data is internally consistent and matches raid-rewards", () => {
  assert.deepEqual(checkCheatSheet(CHEATSHEET_DATA), []);
});

test("every source in the data file is kept with a url and check date", () => {
  for (const source of Object.values(CHEATSHEET_DATA.sources)) {
    assert.match(source.url, /^https:\/\//);
    assert.match(source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("a well-formed sheet passes and lookups find it", () => {
  assert.deepEqual(checkCheatSheet(sample()), []);
  assert.equal(cheatSheetFor("no-such-raid", "NORMAL"), null);
});

test("the checker catches the mistakes it is meant to catch", () => {
  const broken = sample();
  const gate = broken.raids[0].difficulties[0].gates[0];
  gate.patterns[0].sources = ["nowhere"];
  gate.patterns[0].description = "공략 글 기준이며 실제와 다를 수 있음";
  gate.patterns[0].hpBars = { from: 10, to: 20 };
  gate.patterns.push(structuredClone(gate.patterns[1]));
  broken.sources["other-1"] = { title: "블로그", url: "https://example.com/blog", checkedAt: "2026-10-12", kind: "OTHER" };
  gate.patterns[1].sources = ["other-1"];
  broken.raids[0].difficulties[0].gates.push({ ...gate, gate: 9 });
  broken.raids.push({ raidId: "no-such-raid", difficulties: [] });
  const problems = checkCheatSheet(broken);
  for (const expected of [
    "unknown source",
    "names a source or hedges",
    "hp bars from below to",
    "duplicate pattern id",
    "only one OTHER source",
    "gate out of order",
    "gates, raid-rewards has",
    "not in raid-rewards",
  ])
    assert.ok(problems.some((p) => p.includes(expected)), expected);
});

test("an empty gate must say why, and a filled one must not", () => {
  const broken = sample();
  const [filled, empty] = broken.raids[0].difficulties[0].gates;
  empty.missingReason = null;
  filled.missingReason = "필요 없음";
  const problems = checkCheatSheet(broken);
  assert.ok(problems.some((p) => p.includes("no patterns and no missingReason")));
  assert.ok(problems.some((p) => p.includes("missingReason set but patterns present")));
});

test("hp bar ranges cannot exceed the boss total, and difficulties must exist", () => {
  const broken = sample();
  broken.raids[0].difficulties[0].gates[0].patterns[0].hpBars = { from: 400, to: 300 };
  broken.raids[0].difficulties.push({ difficulty: "STAGE_3", gates: [] });
  const problems = checkCheatSheet(broken);
  assert.ok(problems.some((p) => p.includes("above the boss total")));
  assert.ok(problems.some((p) => p.includes("difficulty not in raid-rewards")));
});
