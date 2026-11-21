import assert from "node:assert/strict";
import test from "node:test";
import { MENU_ROWS, menuMatches, quickTools, QUICK_TOOL_HREFS, splitPrefix, stepActive } from "../lib/search/panel";

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

test("menu search: every match on request, more than the eight shown for a short word (M53)", () => {
  assert.equal(MENU_ROWS, 8);
  const all = menuMatches("기", {}, Infinity);
  assert.ok(all.length > MENU_ROWS, `기: ${all.length}`);
  assert.equal(new Set(all.map((h) => h.href)).size, all.length, "one row per address");
  assert.deepEqual(menuMatches("기", {}).map((h) => h.id), all.slice(0, 5).map((h) => h.id), "default limit 5, same order");
  assert.ok(menuMatches("랭킹", {}, Infinity).length <= MENU_ROWS, "랭킹 (mobile spec) needs no more row");
});

test("도구 바로가기: the menu's own names in a fixed order, the flagged tool last and only when on (M53)", () => {
  const off = quickTools({});
  assert.deepEqual(off.map((t) => t.href), ["/tools/refining", "/tools/auction", "/market", "/tools/homework"]);
  assert.deepEqual(off.map((t) => t.label), ["재련 기대 비용", "경매 입찰가", "거래소 시세", "숙제 체크"]);
  assert.ok(off.every((t) => t.description && t.id === `tool:${t.href}`));
  const on = quickTools({ combatPower: true });
  assert.deepEqual(on.map((t) => t.href), [...QUICK_TOOL_HREFS]);
  assert.equal(on.at(-1)?.label, "전투력 시뮬레이터");
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
  assert.deepEqual(splitPrefix("목캐릭터", "목캐"), { head: "목캐", tail: "릭터" });
  assert.deepEqual(splitPrefix("목캐릭터", " 목 "), { head: "목", tail: "캐릭터" });
  assert.deepEqual(splitPrefix("목캐릭터", "캐릭"), { head: "", tail: "목캐릭터" });
});

test("suggest envelope: the backend's answer with a null portrait passes", async () => {
  const { isSuggestEnvelope } = await import("../lib/character/suggest");
  const ok = { code: "CHARACTER_SUGGEST_SUCCESS", message: "ok", data: { items: [{ characterName: "목캐릭터A", serverName: "아만", className: "블레이드", itemLevel: 1700, characterImage: null }] } };
  assert.equal(isSuggestEnvelope(ok), true);
  assert.equal(isSuggestEnvelope({ ...ok, data: { items: [] } }), true);
  assert.equal(isSuggestEnvelope({ ...ok, code: "CHARACTER_POPULAR_SUCCESS" }), false);
});
