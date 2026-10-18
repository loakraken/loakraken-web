import assert from "node:assert/strict";
import test from "node:test";
import { guildSearch, guildValue, isGuildName, isGuildRankingEnvelope, parseGuildQuery } from "../lib/stats/guild-ranking";
import { sampleText } from "../lib/stats/model";
import { isGuildRankingEnabled, isGuildTabEnabled } from "../lib/tools/flags";
import { PRODUCTION_URL } from "../lib/site";

const meta = {
  population: 31,
  conditions: { server: null, role: null, className: null, activeDays: 30, itemLevelMin: 1640, itemLevelMax: null, combatPowerMin: null, combatPowerMax: null, representativeOnly: false },
  aggregatedAt: "2026-10-11T07:00:00Z",
  snapshot: "latest",
  ruleVersion: "stats-v1",
  minSample: 30,
  sampleStatus: "READY" as const,
  coverage: { observedCharacters: 400, knownCharacters: 500, discoveredAccounts: 90 },
  populationUnit: "GUILD",
};
const row = { rank: 1, serverName: "아만", guildName: "합성길드", memberCount: 5, itemLevelAvg: 1656, itemLevelSum: 8280, combatPowerAvg: null, combatPowerCount: 0 };

test("guild query: defaults, shared links and unknown values", () => {
  assert.deepEqual(parseGuildQuery(new URLSearchParams("")), { sort: "CP_AVG", server: undefined, guild: undefined, page: 1 });
  const q = parseGuildQuery(new URLSearchParams("sort=SUM&server=아만&page=2"));
  assert.deepEqual(q, { sort: "SUM", server: "아만", guild: undefined, page: 2 });
  assert.equal(guildSearch(q).toString(), new URLSearchParams("type=guilds&sort=SUM&server=아만&page=2").toString());
  assert.deepEqual(parseGuildQuery(new URLSearchParams("sort=MAX&server=<x>&page=0")), { sort: "CP_AVG", server: undefined, guild: undefined, page: 1 });
  // The item level views are kept in the link; the 1750+ combat power average is the default.
  assert.equal(guildSearch(parseGuildQuery(new URLSearchParams("sort=AVG"))).get("sort"), "AVG");
  assert.equal(parseGuildQuery(new URLSearchParams("sort=CP_SUM")).sort, "CP_SUM");
  assert.equal(guildSearch(parseGuildQuery(new URLSearchParams(""))).toString(), "type=guilds");
});

test("guild ranking envelope follows the contract", () => {
  const ok = { code: "GUILD_RANKING_SUCCESS", message: "ok", data: { meta, sort: "AVG", page: 1, size: 50, minMembers: 5, excludedGuilds: 0, excludedMatches: null, matchCount: null, rows: [row] } };
  assert.equal(isGuildRankingEnvelope(ok), true);
  assert.equal(isGuildRankingEnvelope({ ...ok, code: "ROSTER_RANKING_SUCCESS" }), false);
  assert.equal(isGuildRankingEnvelope({ ...ok, data: { ...ok.data, rows: [{ ...row, memberCount: "5" }] } }), false);
});

test("1750+ combat power fields (api #589): optional until that backend ships; a missing value ranks nowhere", () => {
  const top = { ...row, combatPowerAvg: 3000.5, combatPowerCount: 5, combatPowerAvgTop: 3105.2, combatPowerTopCount: 3, combatPowerTotal: 15002.5 };
  const env = (r: object) => ({ code: "GUILD_RANKING_SUCCESS", message: "ok", data: { meta, sort: "CP_AVG", page: 1, size: 50, minMembers: 5, excludedGuilds: 0, excludedMatches: null, matchCount: null, rows: [r] } });
  assert.equal(isGuildRankingEnvelope(env(top)), true);
  assert.equal(isGuildRankingEnvelope(env({ ...top, combatPowerAvgTop: null, combatPowerTopCount: 0 })), true);
  assert.equal(isGuildRankingEnvelope(env(row)), true); // a backend from before them
  assert.equal(isGuildRankingEnvelope(env({ ...top, combatPowerAvgTop: "3105" })), false);
  assert.equal(guildValue(top, "CP_AVG"), 3105.2);
  assert.equal(guildValue(top, "CP_SUM"), 15002.5);
  assert.equal(guildValue(top, "SUM"), 8280);
  assert.equal(guildValue({ ...top, combatPowerAvgTop: null }, "CP_AVG"), null);
  assert.equal(guildValue(row, "CP_AVG"), null);
});
test("guild sample is told in guilds, never as the whole game", () => {
  assert.match(sampleText(meta, "guild"), /LOAKraken이 확인한 캐릭터로 묶은 길드 · 아이템 레벨 1,640 이상 31개 길드 기준$/);
});

test("guild ranking tab: on unless turned off, hidden on the production host", () => {
  assert.equal(isGuildRankingEnabled({}), true);
  assert.equal(isGuildRankingEnabled({ GUILD_RANKING: "off" }), false);
  assert.equal(isGuildRankingEnabled({ SITE_URL: PRODUCTION_URL }), false);
  assert.equal(isGuildRankingEnabled({ SITE_URL: PRODUCTION_URL, GUILD_RANKING: "on" }), true);
});

test("guild tab: its own switch, apart from the guild ranking (api #582)", () => {
  assert.equal(isGuildTabEnabled({}), true);
  assert.equal(isGuildTabEnabled({ GUILD_TAB: "off" }), false);
  assert.equal(isGuildTabEnabled({ SITE_URL: PRODUCTION_URL }), false);
  assert.equal(isGuildTabEnabled({ SITE_URL: PRODUCTION_URL, GUILD_TAB: "on" }), true);
  // The ranking switch does not move the tab, nor the tab the ranking.
  assert.equal(isGuildTabEnabled({ SITE_URL: PRODUCTION_URL, GUILD_RANKING: "on" }), false);
  assert.equal(isGuildRankingEnabled({ SITE_URL: PRODUCTION_URL, GUILD_TAB: "on" }), false);
});

test("guild query: a name part of 1~12 letters or digits, kept in the link and sent on", () => {
  const q = parseGuildQuery(new URLSearchParams("guild=로아&server=아만"));
  assert.equal(q.guild, "로아");
  assert.equal(guildSearch(q).get("guild"), "로아");
  assert.equal(parseGuildQuery(new URLSearchParams("guild=로아 사랑")).guild, undefined);
  assert.equal(parseGuildQuery(new URLSearchParams("guild=가나다라마바사아자차카타파")).guild, undefined);
  assert.equal(isGuildName("Kraken12"), true);
  assert.equal(isGuildName(""), false);
});
