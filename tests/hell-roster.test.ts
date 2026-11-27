import assert from "node:assert/strict";
import test from "node:test";
import { cleanRoster, keyLevelFor, rosterOf } from "../lib/tools/hell-roster";
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

test("hell roster: only a well-formed stored roster survives; a picked name must be in it", () => {
  const good = {
    name: "지옥원정대",
    fetchedAt: "2026-11-28T01:00:00Z",
    members: [{ characterName: "지옥둘", className: "바드", itemLevel: 1760.83 }],
    picked: "지옥둘",
  };
  assert.deepEqual(cleanRoster(good), good);
  assert.equal(cleanRoster({ ...good, picked: "남" })?.picked, null);
  for (const bad of [
    null,
    [],
    "x",
    { ...good, name: "" },
    { ...good, name: "<script>" },
    { ...good, fetchedAt: "어제" },
    { ...good, members: "x" },
    { ...good, members: [{ characterName: "지옥둘", className: "바드", itemLevel: "1760" }] },
    { ...good, members: [{ characterName: "지옥둘", className: "바드", itemLevel: Number.NaN }] },
    { ...good, members: [{ characterName: "a b", className: "바드", itemLevel: 1700 }] },
    { ...good, members: [null] },
  ])
    assert.equal(cleanRoster(bad), null, JSON.stringify(bad));
});
