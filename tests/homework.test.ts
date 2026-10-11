import assert from "node:assert/strict";
import test from "node:test";
import {
  GOLD_CHARACTERS,
  addCharacters,
  characterCheckState,
  moveRaid,
  nextCleared,
  raidCheckState,
  setCharacterCleared,
  setRaidCleared,
  STORAGE_KEY,
  autoRaids,
  characterGold,
  emptyState,
  modeOf,
  unsettledModes,
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
  // 종막 하드 48,000 > 세르카 하드 44,000 (빈 정보 전수표 E4, 10-12) > 지평의 성당
  // 2단계 40,000.
  assert.deepEqual(at1730, ["kazeros-final/HARD", "serka/HARD", "horizon-cathedral/STAGE_2"]);
  // Unsettled gold is never auto-picked, singles and extremes neither.
  assert.ok(
    autoRaids(1780).every(
      (r) => modeOf(r)?.status !== "UNVERIFIED" && r.difficulty !== "SINGLE",
    ),
  );
  assert.ok(autoRaids(1780).every((r) => !r.raidId.endsWith("extreme")));
  assert.deepEqual(autoRaids(1400), [], "too low for any gold raid with a settled value");
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
    { name: "기준캐릭터A", server: "루페온", className: "블레이드", itemLevel: 1730 },
  ]).characters;
  // 종막 하드: 16,000 + 32,000, bonus 5,120 + 10,240.
  const finalHard = character.raids[0];
  finalHard.cleared = [true, false];
  finalHard.more = [true, false];
  const gold = characterGold(character);
  assert.equal(gold.earned, 16000 - 5120);
  assert.equal(gold.possible, 48000 - 5120 + 44000 + 40000);
  assert.equal(gold.possibleBound, 40000, "지평의 성당 is all bound");
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
  // 발탄 노말 has no official value yet: its gates count as unknown, not 0G.
  character.raids = [{ raidId: "valtan", difficulty: "NORMAL", cleared: [true, true], more: [false, false] }];
  const gold = characterGold(character);
  assert.equal(gold.earned, 0);
  assert.equal(gold.unknownGates, 2);
});

test("a new week clears progress but keeps the setup", () => {
  const state = addCharacters(emptyState(kst("2026-10-09T12:00:00")), [
    { name: "기준캐릭터A", server: "루페온", className: "블레이드", itemLevel: 1730 },
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

test("기준캐릭터A roster weekly total (web #270, 계산 검증)", () => {
  // 계산 검증 02:45: 401,100G for the top six characters.
  const roster = [
    ["기준캐릭터A", 1770],
    ["원정대캐릭터B", 1723.33],
    ["원정대캐릭터C", 1704.33],
    ["원정대캐릭터D", 1585],
    ["원정대캐릭터E", 1585],
    ["원정대캐릭터F", 1556.67],
  ].map(([name, itemLevel]) => ({ name: String(name), server: "루페온", className: "", itemLevel: Number(itemLevel) }));
  const state = addCharacters(emptyState(0), roster);
  const totals = state.characters.map((c) => characterGold(c).possible);
  assert.deepEqual(totals, [166000, 110000, 84000, 14600, 14600, 11900]);
  assert.equal(rosterSummary(state).possible, 401100);
  // Every pick is settled; nothing unsettled could replace one.
  assert.deepEqual(unsettledModes(state.characters), []);
  // 1,612: 카멘·상아탑 노말 are settled since 10-12 (공식 13148), so nothing
  // unsettled could replace a pick there either.
  const [low] = addCharacters(emptyState(0), [{ name: "카멘", server: "", className: "", itemLevel: 1612 }]).characters;
  assert.deepEqual(unsettledModes([low]), []);
});

test("equal gold picks the newer raid (#277 P2)", () => {
  // 원정대캐릭터B 1,723.33: 종막 노말 and 세르카 노말 both pay 32,000 at entry 1,710.
  const picks = autoRaids(1723.33).map((r) => `${r.raidId}/${r.difficulty}`);
  assert.deepEqual(picks, ["horizon-cathedral/STAGE_2", "kazeros-act4/HARD", "serka/NORMAL"]);
});

test("moving a raid reorders the stored list, and gold follows the order (사용자 14:44)", () => {
  const now = Date.parse("2026-10-11T03:00:00Z");
  const state = addCharacters(emptyState(now), [
    { name: "순서", server: "루페온", className: "블래스터", itemLevel: 1730 },
  ]);
  const before = state.characters[0];
  assert.ok(before.raids.length >= 3);
  const extra = { ...before, raids: [...before.raids, { ...before.raids[0], raidId: "behemoth", difficulty: "NORMAL" as const }] };
  // Last raid to the top: it is now among the first three and pays gold; the
  // previous third does not.
  const moved = moveRaid(extra, extra.raids.length - 1, 0);
  assert.equal(moved.raids[0].raidId, "behemoth");
  assert.deepEqual(moved.raids.slice(1).map((r) => r.raidId), extra.raids.slice(0, -1).map((r) => r.raidId));
  // Out of range or no-op: unchanged (same object).
  assert.equal(moveRaid(extra, 0, 0), extra);
  assert.equal(moveRaid(extra, -1, 2), extra);
  assert.equal(moveRaid(extra, 0, 99), extra);
  // Stored as is: the order survives a save and load (no new field, version 1).
  const saved = JSON.stringify({ ...state, characters: [moved] });
  const loaded = parseState(saved, now);
  assert.deepEqual(loaded.characters[0].raids.map((r) => r.raidId), moved.raids.map((r) => r.raidId));
  assert.equal(STORAGE_KEY, "loakraken-homework");
});

test("전체 체크: raid and character tri-state, and bulk ticks keep bonus choices", () => {
  const now = Date.parse("2026-10-11T03:00:00Z");
  const c = addCharacters(emptyState(now), [{ name: "체크", server: "루페온", className: "블래스터", itemLevel: 1730 }]).characters[0];
  const raid = { ...c.raids[0], more: c.raids[0].more.map((_, i) => i === 0) };
  assert.equal(raidCheckState(raid), "none");
  const partly = { ...raid, cleared: raid.cleared.map((_, i) => i === 0) };
  assert.equal(raidCheckState(partly), raid.cleared.length > 1 ? "some" : "all");
  const all = setRaidCleared(partly, nextCleared(raidCheckState(partly)));
  assert.equal(raidCheckState(all), "all");
  assert.deepEqual(all.more, raid.more, "bonus choices stay");
  assert.equal(raidCheckState(setRaidCleared(all, nextCleared("all"))), "none");

  const mixed = { ...c, raids: [all, ...c.raids.slice(1)] };
  assert.equal(characterCheckState(mixed), "some");
  assert.equal(characterCheckState(setCharacterCleared(mixed, true)), "all");
  assert.equal(characterCheckState(setCharacterCleared(mixed, false)), "none");
  assert.equal(characterCheckState({ ...c, raids: [] }), "none");
});
