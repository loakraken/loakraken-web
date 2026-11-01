import assert from "node:assert/strict";
import test from "node:test";
import { standingReason, topPercentText } from "../lib/character/collectible-standing";
import { isStandingEnvelope } from "../lib/character/collectible-standing.backend";

test("collectible standing: no-rank reasons in Korean, unknown codes fall back", () => {
  // The processing-stop list reads exactly like no record (PM-프론트 00:59).
  assert.equal(standingReason("EXCLUDED", 30), standingReason("NOT_OBSERVED", 30));
  assert.equal(standingReason("NOT_OBSERVED", 30), "아직 확인한 기록이 없어요.");
  assert.equal(standingReason("INACTIVE", 7), "최근 7일 안에 확인되지 않았어요.");
  assert.equal(standingReason("NO_COLLECTIBLES", 30), "모은 수집품이 없어요.");
  assert.equal(standingReason("SOMETHING_NEW", 30), "순위를 낼 수 없어요.");
});

test("collectible standing: top percent rounds up at the first decimal", () => {
  assert.equal(topPercentText(31.91), "32%");
  assert.equal(topPercentText(31.81), "31.9%");
  assert.equal(topPercentText(1), "1%");
  assert.equal(topPercentText(null), null);
});

test("collectible standing envelope: code checked, unknown reason accepted", () => {
  const meta = {
    population: 10, conditions: { server: null, role: null, className: null, activeDays: 30, itemLevelMin: 1640, itemLevelMax: null, combatPowerMin: null, combatPowerMax: null, representativeOnly: false },
    aggregatedAt: "2026-10-11T07:00:00Z", snapshot: "latest", ruleVersion: "stats-v1", minSample: 30, sampleStatus: "COLLECTING",
    coverage: { observedCharacters: 1, knownCharacters: 1, discoveredAccounts: 0 }, populationUnit: "ROSTER",
  };
  const data = { meta, unit: "ROSTER", characterName: "상세", serverName: null, rank: null, total: 0, topPercent: null, progressPercent: null, point: null, maxPoint: null, reason: "NEW_CODE" };
  assert.equal(isStandingEnvelope({ code: "COLLECTIBLE_STANDING_SUCCESS", message: "ok", data }), true);
  assert.equal(isStandingEnvelope({ code: "OTHER", message: "ok", data }), false);
});
