import assert from "node:assert/strict";
import test from "node:test";
import { RECENT_LIMIT, addRecent, parseRecent, readSnapshot, type RecentCharacter } from "../lib/character/recent";

const entry = (name: string, at = 1): RecentCharacter => ({ name, server: "아만", className: "블레이드", itemLevel: 1770, at });

test("recent list is newest first, one row per name, capped", () => {
  let list = [entry("a"), entry("b")];
  list = addRecent(list, entry("b", 2));
  assert.deepEqual(list.map((item) => item.name), ["b", "a"]);
  for (let i = 0; i < 20; i++) list = addRecent(list, entry(`n${i}`));
  assert.equal(list.length, RECENT_LIMIT);
  assert.equal(list[0].name, "n19");
});

test("stored data is parsed defensively and the saving flag rides in the snapshot", () => {
  assert.deepEqual(parseRecent("not json"), []);
  assert.deepEqual(parseRecent(JSON.stringify([{ name: 1 }, entry("ok")])).map((i) => i.name), ["ok"]);
  assert.equal(readSnapshot(`|${JSON.stringify([entry("a")])}`).saving, true);
  assert.deepEqual(readSnapshot("1|[]"), { saving: false, list: [] });
});

test("the character image rides with an entry; older rows without one still parse", () => {
  const withImage = { ...entry("a"), image: "https://cdn-lostark.game.onstove.com/a.png" };
  const list = parseRecent(JSON.stringify([withImage, entry("old"), { ...entry("bad"), image: 3 }]));
  assert.deepEqual(list.map((i) => [i.name, i.image ?? null]), [["a", withImage.image], ["old", null]]);
});