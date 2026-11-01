import assert from "node:assert/strict";
import test from "node:test";
import { FAVORITES_LIMIT, parseFavoriteImages, parseFavorites, toggleFavorite, withFavoriteImage } from "../lib/character/favorites";

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

test("favorite images: string addresses by name, anything malformed dropped", () => {
  assert.deepEqual(parseFavoriteImages('{"가":"https://a/1.png","나":3,"다":""}'), { 가: "https://a/1.png" });
  for (const raw of [null, "", "[]", "null", "1", "{"]) assert.deepEqual(parseFavoriteImages(raw), {}, String(raw));
});

test("favorite images: kept for favourites only; set on a star, gone on an unstar", () => {
  const images = { 가: "https://a/1.png", 옛: "https://a/0.png" };
  // Starred with its image; a name no longer starred drops out.
  assert.deepEqual(withFavoriteImage(images, ["나", "가"], "나", "https://a/2.png"), { 가: "https://a/1.png", 나: "https://a/2.png" });
  // Unstarred: its image goes too.
  assert.deepEqual(withFavoriteImage(images, ["옛"], "가", "https://a/1.png"), { 옛: "https://a/0.png" });
  // Starred without a known image (an old entry): the first letter shows until a visit.
  assert.deepEqual(withFavoriteImage({}, ["가"], "가", null), {});
});