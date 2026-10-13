import assert from "node:assert/strict";
import test from "node:test";
import { equipShare, isTitleEquipEnvelope, titleEquipQuery, titleEquipSearch } from "../lib/stats/title-equip";
import { isTitleStatsEnabled } from "../lib/tools/flags";
import { PRODUCTION_URL } from "../lib/site";

const meta = {
  population: 31,
  conditions: { server: null, role: null, className: null, activeDays: 30, itemLevelMin: 0, itemLevelMax: null, combatPowerMin: null, combatPowerMax: null, representativeOnly: false },
  aggregatedAt: "2026-10-11T07:00:00Z",
  snapshot: "latest",
  ruleVersion: "stats-v1",
  minSample: 30,
  sampleStatus: "READY" as const,
  coverage: { observedCharacters: 400, knownCharacters: 500, discoveredAccounts: 31 },
  populationUnit: "ROSTER",
};

test("title equip query: only server and days from the stats filters", () => {
  assert.deepEqual(titleEquipQuery({}), { server: undefined, activeDays: undefined });
  assert.deepEqual(titleEquipQuery({ server: "아만", activeDays: 7 }), { server: "아만", activeDays: 7 });
  assert.deepEqual(titleEquipQuery({ server: "<x>", activeDays: 14 }), { server: undefined, activeDays: undefined });
  assert.equal(titleEquipSearch({ server: "아만", activeDays: 90 }).toString(), new URLSearchParams("server=아만&activeDays=90").toString());
  assert.equal(titleEquipSearch({}).toString(), "");
});

test("title equip envelope follows the contract; shares read as percent or '-'", () => {
  const row = { title: "빛을 꺼트리는 자", equippedRosters: 10, equippedPercent: 32.26 };
  const ok = { code: "TITLE_EQUIP_SUCCESS", message: "ok", data: { meta, title: null, titles: [row] } };
  assert.equal(isTitleEquipEnvelope(ok), true);
  assert.equal(isTitleEquipEnvelope({ ...ok, code: "GUILD_RANKING_SUCCESS" }), false);
  assert.equal(isTitleEquipEnvelope({ ...ok, data: { ...ok.data, titles: [{ ...row, equippedRosters: "10" }] } }), false);
  assert.equal(equipShare(row), "32.26%");
  assert.equal(equipShare({ ...row, equippedPercent: null }), "-");
});

test("title stats: on unless turned off, hidden on the production host", () => {
  assert.equal(isTitleStatsEnabled({}), true);
  assert.equal(isTitleStatsEnabled({ TITLE_STATS: "off" }), false);
  assert.equal(isTitleStatsEnabled({ SITE_URL: PRODUCTION_URL }), false);
  assert.equal(isTitleStatsEnabled({ SITE_URL: PRODUCTION_URL, TITLE_STATS: "on" }), true);
});
