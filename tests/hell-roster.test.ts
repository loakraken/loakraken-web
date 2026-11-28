import assert from "node:assert/strict";
import test from "node:test";
import { cleanRoster, keyLevelFor, memberOf, rosterOf } from "../lib/tools/hell-roster";
import type { SiblingsEnvelope } from "../lib/character/validate";

const LEVELS = [1640, 1700, 1730, 1750];

// X4 (a) (web #1975): a character's card sets the highest key level it can enter.
test("hell roster: key level = the highest entry level at or below the item level", () => {
  for (const [itemLevel, level] of [
    [1760.83, 1750],
    [1750, 1750],
    [1749.99, 1730],
    [1745, 1730],
    [1712.5, 1700],
    [1700, 1700],
    [1650, 1640],
    [1640, 1640],
    [1639.99, null],
    [0, null],
  ] as const)
    assert.equal(keyLevelFor(itemLevel, LEVELS), level, String(itemLevel));
  assert.equal(keyLevelFor(1745, [1750, 1640, 1730, 1700]), 1730, "any order of levels");
});

test("hell roster: the answer kept highest item level first, ties by name, nothing else taken", () => {
  const envelope = {
    code: "CHARACTER_SIBLINGS_SUCCESS",
    message: "",
    data: {
      characterName: "지옥원정대",
      fetchedAt: "2026-11-28T01:00:00Z",
      refreshAvailableAt: null,
      siblings: [
        { characterName: "지옥원정대", serverName: "아만", className: "블래스터", characterLevel: 70, itemLevel: 1712.5 },
        { characterName: "나", serverName: "아만", className: "바드", characterLevel: 70, itemLevel: 1760.83 },
        { characterName: "가", serverName: "루페온", className: "버서커", characterLevel: 70, itemLevel: 1760.83 },
      ],
    },
  } as unknown as SiblingsEnvelope;
  assert.deepEqual(rosterOf(envelope), {
    name: "지옥원정대",
    fetchedAt: "2026-11-28T01:00:00Z",
    members: [
      { characterName: "가", className: "버서커", itemLevel: 1760.83 },
      { characterName: "나", className: "바드", itemLevel: 1760.83 },
      { characterName: "지옥원정대", className: "블래스터", itemLevel: 1712.5 },
    ],
    picked: null,
  });
});

const envelopeOf = (siblings: unknown[], extra: Record<string, unknown> = {}) =>
  ({
    code: "CHARACTER_SIBLINGS_SUCCESS",
    message: "",
    data: { characterName: "지옥섞임", fetchedAt: "2026-11-28T01:00:00Z", refreshAvailableAt: null, siblings, ...extra },
  }) as unknown as SiblingsEnvelope;
const member = (characterName: unknown, className: unknown = "바드", itemLevel: unknown = 1700) => ({
  characterName,
  serverName: "아만",
  className,
  characterLevel: 70,
  itemLevel,
});

// PM-프론트 #1976 P3: names by the site's rule, so real names are kept.
test("hell roster: real names stay (12 Hangul, digits, mixed case); a name with a space or a sign does not", () => {
  for (const name of ["가나다라마바사아자차카타", "Ab12Cd", "지옥99", "abcdefghijklmnop", "ＡＢ"])
    assert.equal(memberOf(member(name))?.characterName, name, name);
  for (const name of ["", " ", "나쁜 이름", "또<나쁨>", "a'b", 12])
    assert.equal(memberOf(member(name)), null, String(name));
  assert.equal(memberOf(member("바드", "x".repeat(31))), null, "a class name past 30");
  assert.equal(memberOf(member("바드", "바드", "1700")), null);
  assert.equal(memberOf(null), null);
});

test("hell roster: one bad member is dropped, the rest kept; nothing left reads as no roster", () => {
  const roster = rosterOf(envelopeOf([member("지옥섞임", "블래스터", 1712.5), member("나쁜 이름", "도화가", 1760), member("Ab12Cd", "버서커", 1745)]));
  assert.deepEqual(
    roster?.members.map((m) => m.characterName),
    ["Ab12Cd", "지옥섞임"],
  );
  assert.equal(rosterOf(envelopeOf([member("나쁜 이름"), member("또<나쁨>")])), null);
  assert.equal(rosterOf(envelopeOf([member("지옥섞임")], { fetchedAt: "어제" })), null);
  // A name listed twice is kept once.
  assert.equal(rosterOf(envelopeOf([member("지옥둘"), member("지옥둘")]))?.members.length, 1);
});

test("hell roster: a stored roster keeps its good members; a bad roster-level field or no member left reads as none", () => {
  const good = {
    name: "지옥원정대",
    fetchedAt: "2026-11-28T01:00:00Z",
    members: [{ characterName: "지옥둘", className: "바드", itemLevel: 1760.83 }],
    picked: "지옥둘",
  };
  assert.deepEqual(cleanRoster(good), good);
  assert.equal(cleanRoster({ ...good, picked: "남" })?.picked, null);
  const mixed = cleanRoster({
    ...good,
    members: [...good.members, { characterName: "a b", className: "바드", itemLevel: 1700 }, null, { characterName: "지옥셋", className: "바드", itemLevel: "1745" }],
  });
  assert.deepEqual(mixed?.members, good.members);
  for (const bad of [
    null,
    [],
    "x",
    { ...good, name: "" },
    { ...good, name: "<script>" },
    { ...good, fetchedAt: "어제" },
    { ...good, members: "x" },
    { ...good, members: [] },
    { ...good, members: [{ characterName: "a b", className: "바드", itemLevel: 1700 }] },
  ])
    assert.equal(cleanRoster(bad), null, JSON.stringify(bad));
});