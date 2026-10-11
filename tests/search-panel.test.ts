import assert from "node:assert/strict";
import test from "node:test";
import { menuMatches, splitPrefix, stepActive } from "../lib/search/panel";

test("menu search: label first, description too, spaces ignored, flags respected", () => {
  const hits = menuMatches("숙제", {});
  assert.ok(hits.length > 0);
  assert.equal(hits[0].label, "숙제 체크");
  assert.equal(hits[0].href, "/tools/homework");
  assert.ok(hits.every((h) => h.section && h.href.startsWith("/")));
  assert.ok(menuMatches("레이드보상", {}).some((h) => h.href === "/tools/raid-rewards"), "spaces ignored");
  assert.equal(menuMatches("전투력 시뮬레이터", {}).filter((h) => h.href === "/tools/combat-power").length, 0, "flag off: hidden");
  assert.equal(menuMatches("전투력 시뮬레이터", { combatPower: true }).filter((h) => h.href === "/tools/combat-power").length, 1);
  assert.deepEqual(menuMatches("   ", {}), []);
  assert.ok(menuMatches("e", {}).length <= 5);
});

test("arrow keys wrap around the rows", () => {
  const ids = ["a", "b", "c"];
  assert.equal(stepActive(ids, null, 1), "a");
  assert.equal(stepActive(ids, null, -1), "c");
  assert.equal(stepActive(ids, "c", 1), "a");
  assert.equal(stepActive(ids, "a", -1), "c");
  assert.equal(stepActive(ids, "gone", 1), "a");
  assert.equal(stepActive([], "a", 1), null);
});

test("the typed prefix of a suggested name", () => {
  assert.deepEqual(splitPrefix("언새늘", "언새"), { head: "언새", tail: "늘" });
  assert.deepEqual(splitPrefix("언새늘", " 언 "), { head: "언", tail: "새늘" });
  assert.deepEqual(splitPrefix("언새늘", "새늘"), { head: "", tail: "언새늘" });
});

test("suggest envelope: the backend's answer with a null portrait passes", async () => {
  const { isSuggestEnvelope } = await import("../lib/character/suggest");
  const ok = { code: "CHARACTER_SUGGEST_SUCCESS", message: "ok", data: { items: [{ characterName: "언새늘", serverName: "아만", className: "블레이드", itemLevel: 1770, characterImage: null }] } };
  assert.equal(isSuggestEnvelope(ok), true);
  assert.equal(isSuggestEnvelope({ ...ok, data: { items: [] } }), true);
  assert.equal(isSuggestEnvelope({ ...ok, code: "CHARACTER_POPULAR_SUCCESS" }), false);
});
