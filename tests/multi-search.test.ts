import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Character } from "../lib/character/model";
import {
  MULTI_SEARCH_LIMIT,
  bestNames,
  namesFromParam,
  namesSearch,
  parseNames,
  sortFromParam,
  summarize,
  valueOf,
  type Summary,
} from "../lib/multi-search/model";

const fixture = (): Character =>
  JSON.parse(readFileSync(new URL("./fixtures/character-full-data.json", import.meta.url), "utf8"));

test("names split on commas, spaces and new lines; duplicates and non-names are left out", () => {
  const parsed = parseNames(" 이름1, 이름2\n이름3 이름1 / 이름!  ");
  assert.deepEqual(parsed.names, ["이름1", "이름2", "이름3"]);
  assert.deepEqual(parsed.invalid, ["이름!"]);
  assert.deepEqual(parsed.dropped, []);
});

test("more than the limit keeps the first ones and reports the rest", () => {
  const parsed = parseNames(Array.from({ length: 8 }, (_, i) => `캐릭${i}`).join(","));
  assert.equal(parsed.names.length, MULTI_SEARCH_LIMIT);
  assert.deepEqual(parsed.dropped, ["캐릭6", "캐릭7"]);
});

test("the address round-trips and ignores what is not a name", () => {
  assert.deepEqual(namesFromParam("가,나,<b>"), ["가", "나"]);
  assert.deepEqual(namesFromParam(null), []);
  assert.equal(namesSearch([]), "");
  assert.deepEqual(namesFromParam(new URLSearchParams(namesSearch(["가", "나"]).slice(1)).get("names")), ["가", "나"]);
});

test("the table order rides in the address too, only next to names", () => {
  assert.deepEqual(sortFromParam("gems-desc"), { key: "gems", dir: "desc" });
  assert.deepEqual(sortFromParam("itemLevel-asc"), { key: "itemLevel", dir: "asc" });
  for (const bad of [null, "", "gems", "gems-up", "name-asc", "gems-desc-x"]) assert.equal(sortFromParam(bad), null, String(bad));
  const search = new URLSearchParams(namesSearch(["가", "나"], { key: "quality", dir: "asc" }).slice(1));
  assert.deepEqual(namesFromParam(search.get("names")), ["가", "나"]);
  assert.deepEqual(sortFromParam(search.get("sort")), { key: "quality", dir: "asc" });
  assert.equal(namesSearch([], { key: "gems", dir: "desc" }), "");
  assert.equal(new URLSearchParams(namesSearch(["가"]).slice(1)).has("sort"), false);
});
test("a character summary carries the compared values", () => {
  const s = summarize(fixture());
  assert.equal(s.name, "모험가");
  assert.equal(s.itemLevel, 1700.5);
  assert.equal(valueOf(s.combatPower), 12345.67);
  assert.deepEqual(valueOf(s.engravings), [{ name: "패시브 각인", level: 4, grade: "유물" }]);
  assert.deepEqual(valueOf(s.arkPassive), [{ tree: "진화", value: 120 }]);
  assert.deepEqual(valueOf(s.refine), { min: 19, max: 19 });
  assert.equal(valueOf(s.quality), 95);
  assert.deepEqual(valueOf(s.gems), { average: 9, count: 1 });
});

test("a missing value says why in a few words", () => {
  const data = fixture();
  data.combatPower = null;
  data.loadout.engravings!.arkPassiveEffects = [];
  data.coverage.engravings.collections = { ...data.coverage.engravings.collections, arkPassiveEffects: "NOT_PROVIDED" };
  data.analysis.gems = null;
  data.coverage.gems.state = "PROVIDED_EMPTY";
  data.coverage.gems.collections = {};
  const s = summarize(data);
  assert.deepEqual(s.combatPower, { reason: "미제공" });
  assert.deepEqual(s.engravings, { reason: "미제공" });
  assert.deepEqual(s.gems, { reason: "보석 없음" });
});

test("the best mark goes to the highest value, never to a tie for everyone", () => {
  const rows = [
    { name: "a", itemLevel: 1700 },
    { name: "b", itemLevel: 1720 },
    { name: "c", itemLevel: 1720 },
  ] as Summary[];
  assert.deepEqual(bestNames(rows, (s) => s.itemLevel), ["b", "c"]);
  assert.deepEqual(bestNames(rows.slice(1), (s) => s.itemLevel), []);
  assert.deepEqual(bestNames(rows.slice(0, 1), (s) => s.itemLevel), []);
});
