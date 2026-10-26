import assert from "node:assert/strict";
import test from "node:test";
import { FAVORITES_LIMIT, parseFavorites, toggleFavorite, type FavoriteCharacter } from "../lib/character/favorites";

const entry = (name: string, at = 1): FavoriteCharacter => ({ name, server: "루페온", className: "바드", itemLevel: 1700, at });

test("favorites: toggle adds newest first and removes a starred name", () => {
  const one = toggleFavorite([], entry("가"));
  assert.deepEqual(one.map((c) => c.name), ["가"]);
  const two = toggleFavorite(one, entry("나", 2));
  assert.deepEqual(two.map((c) => c.name), ["나", "가"]);
  assert.deepEqual(toggleFavorite(two, entry("가", 3)).map((c) => c.name), ["나"]);
});

test("favorites: capped, the oldest drops off", () => {
  let list: FavoriteCharacter[] = [];
  for (let i = 0; i < FAVORITES_LIMIT + 3; i++) list = toggleFavorite(list, entry(`c${i}`, i));
  assert.equal(list.length, FAVORITES_LIMIT);
  assert.equal(list[0].name, `c${FAVORITES_LIMIT + 2}`);
});

test("favorites: malformed storage is dropped, not thrown", () => {
  assert.deepEqual(parseFavorites("not json"), []);
  assert.deepEqual(parseFavorites('{"a":1}'), []);
  assert.deepEqual(parseFavorites(null), []);
  assert.deepEqual(
    parseFavorites(JSON.stringify([entry("가"), { name: "", at: 1 }, { name: "나" }])).map((c) => c.name),
    ["가"],
  );
});
