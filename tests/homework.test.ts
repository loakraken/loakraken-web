import assert from "node:assert/strict";
import test from "node:test";
import {
  GOLD_CHARACTERS,
  addCharacters,
  autoRaids,
  characterGold,
  emptyState,
  formatCountdown,
  nextReset,
  parseState,
  rollWeek,
  rosterSummary,
  weekStart,
} from "../lib/tools/homework";

const kst = (iso: string) => Date.parse(`${iso}+09:00`);

test("the homework week starts on Wednesday 06:00 KST", () => {
  // 2026-10-07 is a Wednesday.
  assert.equal(weekStart(kst("2026-10-07T06:00:00")), kst("2026-10-07T06:00:00"));
  assert.equal(weekStart(kst("2026-10-07T05:59:59")), kst("2026-09-30T06:00:00"));
  assert.equal(weekStart(kst("2026-10-09T15:00:00")), kst("2026-10-07T06:00:00"));
  assert.equal(weekStart(kst("2026-10-14T05:00:00")), kst("2026-10-07T06:00:00"));
  assert.equal(nextReset(kst("2026-10-09T15:00:00")), kst("2026-10-14T06:00:00"));
});

test("auto raids pick the three best known modes for the level", () => {
  const at1730 = autoRaids(1730).map((r) => `${r.raidId}/${r.difficulty}`);
  // 종막 하드 48,000 > 4막 하드 38,000 > 세르카 노말 32,000 (official values).
  assert.deepEqual(at1730, ["kazeros-final/HARD", "kazeros-act4/HARD", "serka/NORMAL"]);
  // Unpublished gold (벨가르딘) is never auto-picked, singles and extremes neither.
  assert.ok(autoRaids(1780).every((r) => r.raidId !== "belgardin" && r.difficulty !== "SINGLE"));
  assert.ok(autoRaids(1780).every((r) => !r.raidId.endsWith("extreme")));
  assert.deepEqual(autoRaids(1500), [], "too low for any end content");
});

test("only six characters get gold, highest level first", () => {
  const roster = Array.from({ length: 8 }, (_, i) => ({
    name: `캐릭${i}`,
    server: "루페온",
    className: "블레이드",
    itemLevel: 1700 + i,
  }));
  const state = addCharacters(emptyState(0), roster);
  assert.equal(state.characters.filter((c) => c.gold).length, GOLD_CHARACTERS);
  assert.equal(state.characters[0].name, "캐릭7");
  assert.equal(state.characters.at(-1)!.gold, false);
  assert.equal(addCharacters(state, roster).characters.length, 8, "no duplicates");
});

test("gold counts cleared gates, subtracts bought bonus rewards", () => {
  const [character] = addCharacters(emptyState(0), [
    { name: "언새늘", server: "루페온", className: "블레이드", itemLevel: 1730 },
  ]).characters;
  // 종막 하드: 16,000 + 32,000, bonus 5,120 + 10,240.
  const finalHard = character.raids[0];
  finalHard.cleared = [true, false];
  finalHard.more = [true, false];
  const gold = characterGold(character);
  assert.equal(gold.earned, 16000 - 5120);
  assert.equal(gold.possible, 48000 - 5120 + 38000 + 32000);
  assert.equal(gold.possibleBound, 16000, "세르카 노말 is half bound");
  assert.equal(gold.moreSpent, 5120);
  // A non-gold character earns nothing but still pays for its bonus rewards.
  const nonGold = characterGold({ ...character, gold: false });
  assert.equal(nonGold.possible, -5120);
  assert.equal(nonGold.earned, -5120);
  assert.equal(nonGold.moreSpent, 5120);
  // Ticking a bonus on a gate that is not cleared yet only lowers the plan.
  finalHard.cleared = [false, false];
  const planned = characterGold({ ...character, gold: false });
  assert.equal(planned.possible, -5120);
  assert.equal(planned.earned, 0);
  assert.equal(planned.moreSpent, 0);
});

test("bonus rewards are paid from bound gold first (notice 13148)", () => {
  const [character] = addCharacters(emptyState(0), [
    { name: "사막", server: "루페온", className: "바드", itemLevel: 1700 },
  ]).characters;
  // 4막 노말 1관문: 10,000 (5,000 bound) + bonus 3,200 → bound 1,800, tradable 5,000.
  character.raids = [{ raidId: "kazeros-act4", difficulty: "NORMAL", cleared: [true, false], more: [true, false] }];
  const gold = characterGold(character);
  assert.equal(gold.earned, 6800);
  assert.equal(gold.earnedBound, 1800);
  assert.equal(gold.earned - gold.earnedBound, 5000);
  // A bonus larger than the bound part takes the rest from tradable gold.
  character.raids = [{ raidId: "kazeros-act4", difficulty: "NORMAL", cleared: [false, true], more: [false, true] }];
  const g2 = characterGold(character);
  assert.equal(g2.earnedBound, 8500 - 5440);
  assert.equal(g2.earned - g2.earnedBound, 8500);
});

test("unknown gold is counted separately, never as zero gold earned", () => {
  const [character] = addCharacters(emptyState(0), [
    { name: "벨가", server: "루페온", className: "바드", itemLevel: 1780 },
  ]).characters;
  character.raids = [{ raidId: "belgardin", difficulty: "HARD", cleared: [true, true], more: [false, false] }];
  const gold = characterGold(character);
  assert.equal(gold.earned, 0);
  assert.equal(gold.unknownGates, 2);
});

test("a new week clears progress but keeps the setup", () => {
  const state = addCharacters(emptyState(kst("2026-10-09T12:00:00")), [
    { name: "언새늘", server: "루페온", className: "블레이드", itemLevel: 1730 },
  ]);
  state.characters[0].raids[0].cleared = [true, true];
  assert.equal(rollWeek(state, kst("2026-10-13T12:00:00")), state, "same week untouched");
  const next = rollWeek(state, kst("2026-10-14T06:00:00"));
  assert.deepEqual(next.characters[0].raids[0].cleared, [false, false]);
  assert.equal(next.characters[0].raids.length, 3);
  assert.equal(rosterSummary(next).gatesDone, 0);
});

test("stored state is parsed defensively", () => {
  const now = kst("2026-10-09T12:00:00");
  assert.equal(parseState(null, now).characters.length, 0);
  assert.equal(parseState("{bad json", now).characters.length, 0);
  assert.equal(parseState(JSON.stringify({ version: 2 }), now).characters.length, 0);
  const stored = JSON.stringify({
    version: 1,
    week: weekStart(now),
    characters: [
      { name: "A", server: "", className: "", itemLevel: 1730, gold: true, raids: [
        { raidId: "kazeros-final", difficulty: "HARD", cleared: [true, false], more: [false, false] },
        { raidId: "removed-raid", difficulty: "HARD", cleared: [true], more: [false] },
        { raidId: "kazeros-final", difficulty: "NORMAL", cleared: [true], more: [false] },
      ] },
      { nope: true },
    ],
  });
  const state = parseState(stored, now);
  assert.equal(state.characters.length, 1);
  assert.equal(state.characters[0].raids.length, 1, "unknown raid and wrong gate count dropped");
});

test("countdown text", () => {
  assert.equal(formatCountdown(4 * 86400_000 + 3 * 3600_000), "4일 3시간");
  assert.equal(formatCountdown(2 * 3600_000 + 5 * 60_000), "2시간 5분");
  assert.equal(formatCountdown(-1), "0분");
});
