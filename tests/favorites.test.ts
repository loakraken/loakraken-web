import assert from "node:assert/strict";
import test from "node:test";
import { FAVORITES_LIMIT, parseFavorites, toggleFavorite } from "../lib/character/favorites";

test("favorites: names newest first, a starred name is removed", () => {
  const one = toggleFavorite([], "가");
  assert.deepEqual(one, ["가"]);
  const two = toggleFavorite(one, "나");
  assert.deepEqual(two, ["나", "가"]);
  assert.deepEqual(toggleFavorite(two, "가"), ["나"]);
});

test("favorites: capped as the character page always was, the oldest drops off", () => {
  let list: string[] = [];
  for (let i = 0; i < FAVORITES_LIMIT + 3; i++) list = toggleFavorite(list, `c${i}`);
  assert.equal(list.length, FAVORITES_LIMIT);
  assert.equal(list[0], `c${FAVORITES_LIMIT + 2}`);
});

test("favorites: the stored list is read defensively (names only)", () => {
  assert.deepEqual(parseFavorites("not json"), []);
  assert.deepEqual(parseFavorites('{"a":1}'), []);
  assert.deepEqual(parseFavorites(null), []);
  assert.deepEqual(parseFavorites(JSON.stringify(["가", "", 3, { name: "나" }, "다"])), ["가", "다"]);
});
