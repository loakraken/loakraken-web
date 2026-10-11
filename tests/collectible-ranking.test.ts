import assert from "node:assert/strict";
import test from "node:test";
import { collectibleSearch, isCollectibleRankingEnvelope, parseCollectibleQuery, progressText } from "../lib/stats/collectible-ranking";

test("collectible query: defaults, shared links and unknown values", () => {
  assert.deepEqual(parseCollectibleQuery(new URLSearchParams("")), { unit: "ROSTER", server: undefined, activeDays: 30, page: 1 });
  const q = parseCollectibleQuery(new URLSearchParams("unit=CHARACTER&server=아만&activeDays=7&page=3"));
  assert.deepEqual(q, { unit: "CHARACTER", server: "아만", activeDays: 7, page: 3 });
  assert.equal(
    collectibleSearch(q).toString(),
    new URLSearchParams("type=collectibles&unit=CHARACTER&server=아만&activeDays=7&page=3").toString(),
  );
  assert.deepEqual(parseCollectibleQuery(new URLSearchParams("unit=NOPE&activeDays=14&page=999")), {
    unit: "ROSTER",
    server: undefined,
    activeDays: 30,
    page: 1,
  });
  assert.equal(collectibleSearch(parseCollectibleQuery(new URLSearchParams(""))).toString(), "type=collectibles");
});

test("collectible ranking envelope follows the captured contract; progress keeps two decimals", () => {
  const meta = {
    population: 0,
    conditions: {
      server: null,
      role: null,
      className: null,
      activeDays: 30,
      itemLevelMin: 1640,
      itemLevelMax: null,
      combatPowerMin: null,
      combatPowerMax: null,
      representativeOnly: false,
    },
    aggregatedAt: "2026-10-11T17:35:49Z",
    snapshot: "latest",
    ruleVersion: "stats-v1",
    minSample: 30,
    sampleStatus: "COLLECTING",
    coverage: { observedCharacters: 1, knownCharacters: 1, discoveredAccounts: 0 },
    populationUnit: "ROSTER",
  };
  // The local backend's empty answer (2026-10-12), as sent.
  const empty = { code: "COLLECTIBLE_RANKING_SUCCESS", message: "ok", data: { meta, unit: "ROSTER", page: 1, size: 2, rows: [] } };
  assert.equal(isCollectibleRankingEnvelope(empty), true);
  const row = {
    rank: 1,
    serverName: "루페온",
    characterName: "합성원정대",
    className: "바드",
    itemLevel: 1740,
    characterCount: 8,
    progressPercent: 99.84,
    point: 1684,
    maxPoint: 1684,
    observedAt: "2026-10-11T07:00:00Z",
    types: [{ type: "모코코 씨앗", point: 1569, maxPoint: 1569 }],
  };
  assert.equal(isCollectibleRankingEnvelope({ ...empty, data: { ...empty.data, rows: [row] } }), true);
  assert.equal(isCollectibleRankingEnvelope({ ...empty, data: { ...empty.data, rows: [{ ...row, progressPercent: "99%" }] } }), false);
  assert.equal(isCollectibleRankingEnvelope({ ...empty, code: "ROSTER_RANKING_SUCCESS" }), false);
  assert.equal(progressText(73.8), "73.80%");
  assert.equal(progressText(100), "100.00%");
});
