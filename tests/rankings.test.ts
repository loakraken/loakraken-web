import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  arkPassiveText,
  efficiencySearch,
  estherText,
  isEfficiencyEnvelope,
  isRankingEnvelope,
  parseEfficiencyQuery,
  parseRankingQuery,
  rankingSearch,
  requestEfficiencyRanking,
  requestRankings,
} from "../lib/stats/rankings";

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

test("K32 row fields: the older sample without them still passes; text for the cells", () => {
  // The captured sample predates bestCombatPower/arkPassivePoints/classEngraving/estherWeapon.
  assert.equal(isRankingEnvelope(fixture()), true);
  const newer = fixture();
  Object.assign(newer.data.rows[0], {
    bestCombatPower: 4810.5,
    arkPassivePoints: { evolution: 140, enlightenment: 101, leap: 70 },
    classEngraving: "광기",
    estherWeapon: { refineLevel: 25, ellaStage: 2 },
  });
  assert.equal(isRankingEnvelope(newer), true);
  assert.equal(estherText({ refineLevel: 25, ellaStage: 2 }), "+25 · 엘라 2단계");
  assert.equal(estherText({ refineLevel: 8, ellaStage: null }), "+8");
  assert.equal(estherText({ refineLevel: null, ellaStage: null }), null);
  assert.equal(estherText(null), null);
  assert.equal(arkPassiveText({ evolution: 140, enlightenment: 101, leap: 70 }), "진화 140 · 깨달음 101 · 도약 70");
  assert.equal(arkPassiveText({ evolution: null, enlightenment: 90, leap: null }), "깨달음 90");
  assert.equal(arkPassiveText(undefined), null);
});

const efficiencySample = () => {
  const base = fixture();
  return {
    code: "RANKING_SUCCESS",
    message: "ok",
    data: {
      meta: base.data.meta,
      kind: "BRACELET",
      ruleVersion: "efficiency-v1",
      populationNote: "캐릭터 검색으로 장비를 관측해 효율을 계산한 캐릭터만 순위에 들어갑니다.",
      page: 1,
      size: 50,
      rows: [
        {
          rank: 1, characterName: "효율1", serverName: "아만", className: "블래스터", position: "DEALER",
          itemLevel: 1780, combatPower: 4700.5, valuePercent: 15.97, observedAt: "2026-10-12T09:00:00Z",
          topPercent: 0.43, tier: "TOP1",
        },
      ],
    },
  };
};

test("efficiency ranking: contract, shareable query and the backend path per kind", async () => {
  assert.equal(isEfficiencyEnvelope(efficiencySample()), true);
  const broken = efficiencySample();
  (broken.data.rows[0] as Record<string, unknown>).valuePercent = "15%";
  assert.equal(isEfficiencyEnvelope(broken), false);
  assert.deepEqual(parseEfficiencyQuery(new URLSearchParams("type=gems&metric=ITEM_LEVEL&page=2&server=아만")), { server: "아만", page: 2 });
  assert.deepEqual(parseEfficiencyQuery(new URLSearchParams("type=gems&page=999")), { page: 1 });
  assert.equal(efficiencySearch("bracelets", { page: 1 }).toString(), "type=bracelets");
  const seen: string[] = [];
  const fetcher = (async (input: URL) => {
    seen.push(`${input.pathname}?${input.searchParams}`);
    return Response.json(efficiencySample());
  }) as unknown as typeof fetch;
  assert.equal((await requestEfficiencyRanking("bracelets", { page: 2 }, "http://127.0.0.1:8080", { fetcher })).ok, true);
  await requestEfficiencyRanking("gems", { page: 1, server: "아만" }, "http://127.0.0.1:8080", { fetcher });
  assert.equal(seen[0], "/api/v1/rankings/bracelets?page=2&size=50");
  assert.match(seen[1], /^\/api\/v1\/rankings\/ark-grid-gems\?server=.+&page=1&size=50$/);
});
