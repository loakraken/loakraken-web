import assert from "node:assert/strict";
import test from "node:test";
import { parseRosterQuery, rosterSearch } from "../lib/stats/roster-ranking";

test("roster query: defaults, shared links and unknown values", () => {
  assert.deepEqual(parseRosterQuery(new URLSearchParams("")), { basis: "COMBAT_POWER", aggregate: "TOP6_AVG", server: undefined, page: 1 });
  const q = parseRosterQuery(new URLSearchParams("basis=ITEM_LEVEL&aggregate=TOP6_SUM&server=아만&page=3"));
  assert.deepEqual(q, { basis: "ITEM_LEVEL", aggregate: "TOP6_SUM", server: "아만", page: 3 });
  assert.equal(rosterSearch(q).toString(), new URLSearchParams("type=roster&basis=ITEM_LEVEL&aggregate=TOP6_SUM&server=아만&page=3").toString());
  assert.deepEqual(parseRosterQuery(new URLSearchParams("basis=NOPE&aggregate=X&page=999")), { basis: "COMBAT_POWER", aggregate: "TOP6_AVG", server: undefined, page: 1 });
  assert.equal(rosterSearch(parseRosterQuery(new URLSearchParams(""))).toString(), "type=roster");
});
