import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isRankingEnvelope, parseRankingQuery, rankingSearch, requestRankings } from "../lib/stats/rankings";

const fixture = () =>
  JSON.parse(readFileSync(new URL("./stats-fixtures/rankings.json", import.meta.url), "utf8"));

test("backend ranking sample satisfies the captured contract", () => {
  assert.equal(isRankingEnvelope(fixture()), true);
  const broken = fixture();
  broken.data.rows[0].rank = "1위";
  assert.equal(isRankingEnvelope(broken), false);
  const newer = fixture();
  newer.data.rows[0].tier = "TOP3";
  assert.equal(isRankingEnvelope(newer), true);
});

test("ranking query: defaults, allow-list and a short shareable URL", () => {
  assert.deepEqual(parseRankingQuery(new URLSearchParams("")), { metric: "COMBAT_POWER", page: 1 });
  assert.deepEqual(parseRankingQuery(new URLSearchParams("metric=ITEM_LEVEL&page=3&className=바드&server=아만")), {
    server: "아만",
    metric: "ITEM_LEVEL",
    page: 3,
    className: "바드",
  });
  for (const bad of ["metric=GOLD", "page=0", "page=201", "page=x", "className=바 드", "role=TANK"])
    assert.equal(parseRankingQuery(new URLSearchParams(bad)), null, bad);
  assert.equal(rankingSearch({ metric: "COMBAT_POWER", page: 1 }).toString(), "");
  assert.equal(rankingSearch({ metric: "ITEM_LEVEL", page: 2, server: "아만" }).toString(), "server=%EC%95%84%EB%A7%8C&metric=ITEM_LEVEL&page=2");
});

test("requests always send metric, page and size 50", async () => {
  let seen: URL | undefined;
  const fetcher = (async (input: URL) => {
    seen = input;
    return Response.json(fixture());
  }) as unknown as typeof fetch;
  const result = await requestRankings({ metric: "COMBAT_POWER", page: 2 }, "http://127.0.0.1:8080", { fetcher });
  assert.equal(result.ok, true);
  assert.equal(seen?.pathname, "/api/v1/rankings");
  assert.equal(seen?.searchParams.get("metric"), "COMBAT_POWER");
  assert.equal(seen?.searchParams.get("page"), "2");
  assert.equal(seen?.searchParams.get("size"), "50");
});
