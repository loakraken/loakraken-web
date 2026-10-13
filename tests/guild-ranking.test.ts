import assert from "node:assert/strict";
import test from "node:test";
import { guildSearch, isGuildName, isGuildRankingEnvelope, parseGuildQuery } from "../lib/stats/guild-ranking";
import { sampleText } from "../lib/stats/model";
import { isGuildRankingEnabled } from "../lib/tools/flags";
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
  assert.deepEqual(parseGuildQuery(new URLSearchParams("")), { sort: "AVG", server: undefined, guild: undefined, page: 1 });
  const q = parseGuildQuery(new URLSearchParams("sort=SUM&server=아만&page=2"));
  assert.deepEqual(q, { sort: "SUM", server: "아만", guild: undefined, page: 2 });
  assert.equal(guildSearch(q).toString(), new URLSearchParams("type=guilds&sort=SUM&server=아만&page=2").toString());
  assert.deepEqual(parseGuildQuery(new URLSearchParams("sort=MAX&server=<x>&page=0")), { sort: "AVG", server: undefined, guild: undefined, page: 1 });
  assert.equal(guildSearch(parseGuildQuery(new URLSearchParams(""))).toString(), "type=guilds");
});

test("guild ranking envelope follows the contract", () => {
  const ok = { code: "GUILD_RANKING_SUCCESS", message: "ok", data: { meta, sort: "AVG", page: 1, size: 50, minMembers: 5, excludedGuilds: 0, excludedMatches: null, matchCount: null, rows: [row] } };
  assert.equal(isGuildRankingEnvelope(ok), true);
  assert.equal(isGuildRankingEnvelope({ ...ok, code: "ROSTER_RANKING_SUCCESS" }), false);
  assert.equal(isGuildRankingEnvelope({ ...ok, data: { ...ok.data, rows: [{ ...row, memberCount: "5" }] } }), false);
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

test("guild query: a name part of 1~12 letters or digits, kept in the link and sent on", () => {
  const q = parseGuildQuery(new URLSearchParams("guild=로아&server=아만"));
  assert.equal(q.guild, "로아");
  assert.equal(guildSearch(q).get("guild"), "로아");
  assert.equal(parseGuildQuery(new URLSearchParams("guild=로아 사랑")).guild, undefined);
  assert.equal(parseGuildQuery(new URLSearchParams("guild=가나다라마바사아자차카타파")).guild, undefined);
  assert.equal(isGuildName("Kraken12"), true);
  assert.equal(isGuildName(""), false);
});
