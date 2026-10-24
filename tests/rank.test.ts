import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TIER_LABEL, TIER_LEGEND, bannerRank, conditionsText, nextTierText, rankCell, rankState, scopeLabel, scopesOf } from "../lib/character/rank";
import { isRankEnvelope, requestRank } from "../lib/character/rank.backend";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./rank-fixtures/${name}`, import.meta.url), "utf8"));

test("the backend sample satisfies the captured contract", () => {
  assert.equal(isRankEnvelope(fixture("character-rank.json")), true);
  const broken = fixture("character-rank.json");
  broken.data.entries[0].rank = "5위";
  assert.equal(isRankEnvelope(broken), false);
  // A tier added later keeps the response; that cell just shows no badge.
  const newer = fixture("character-rank.json");
  newer.data.entries[0].tier = "TOP3";
  assert.equal(isRankEnvelope(newer), true);
  assert.equal((rankCell(newer.data, "COMBAT_POWER", "ALL") as { tier: string | null }).tier, null);
});

test("not included shows dashes, not zeros", () => {
  const ranked = fixture("character-rank.json").data;
  assert.equal(rankState(ranked), "ranked");
  assert.equal(rankState({ ...ranked, included: false, entries: [] }), "excluded");
  assert.deepEqual(rankCell({ ...ranked, entries: [] }, "ITEM_LEVEL", "ALL"), { state: "none" });
});

test("cells: rank of total, top percent and the PM tier names; collecting never shows a number", () => {
  const data = fixture("character-rank.json").data;
  assert.deepEqual(rankCell(data, "COMBAT_POWER", "ALL"), {
    state: "ready",
    rank: "5위",
    total: "40명 중",
    top: "상위 12.5%",
    tier: "대양",
    tierNote: "전투력 순위에서 상위 25% 이내예요(LOAKraken이 확인한 캐릭터 기준).",
    next: "심해까지 전투력 12.34",
  });
  const collecting = structuredClone(data);
  collecting.entries[2] = { ...collecting.entries[2], sampleStatus: "COLLECTING", topPercent: null, tier: null };
  assert.deepEqual(rankCell(collecting, "COMBAT_POWER", "CLASS"), { state: "collecting", total: 35 });
  assert.equal(TIER_LEGEND, "크라켄 1% · 해구 5% · 심해 10% · 대양 25% · 연안 50% 이내");
  assert.deepEqual(TIER_LABEL, { TOP1: "크라켄", TOP5: "해구", TOP10: "심해", TOP25: "대양", TOP50: "연안" });
  assert.equal(scopeLabel(data, "SERVER"), "서버 · 통계테스트서버");
  assert.equal(scopeLabel(data, "ALL"), "전체");
  assert.equal(conditionsText(data), "LOAKraken이 최근 30일 안에 확인한 아이템 레벨 1,640 이상 캐릭터 기준");
});

test("rank requests validate the name and allow-list errors", async () => {
  let calls = 0;
  const fetcher = (async (input: URL) => {
    calls++;
    assert.equal(input.pathname, "/api/v1/characters/rank");
    assert.equal(input.searchParams.get("characterName"), "가1");
    return Response.json({ code: "STATS_CHARACTER_NOT_OBSERVED", message: "secret" }, { status: 404 });
  }) as unknown as typeof fetch;
  assert.equal((await requestRank("", "http://127.0.0.1:8080", { fetcher })).ok, false);
  assert.equal(calls, 0);
  const result = await requestRank(" 가1 ", "http://127.0.0.1:8080", { fetcher });
  assert.deepEqual(result, { ok: false, error: { code: "STATS_CHARACTER_NOT_OBSERVED", status: 404 } });
});

test("server-class box (backend #171) shows only when sent", () => {
  const data = fixture("character-rank.json").data;
  assert.deepEqual(scopesOf(data).map((s) => s.id), ["ALL", "SERVER", "CLASS", "SERVER_CLASS"]);
  assert.equal(scopeLabel(data, "SERVER_CLASS"), "서버 직업 · 통계테스트서버 통계바드");
  assert.deepEqual(rankCell(data, "COMBAT_POWER", "SERVER_CLASS"), {
    state: "ready", rank: "5위", total: "35명 중", top: "상위 14.29%", tier: "대양",
    tierNote: "전투력 순위에서 상위 25% 이내예요(LOAKraken이 확인한 캐릭터 기준).",
    next: "심해까지 전투력 24.68",
  });
  const older = structuredClone(data);
  older.entries = older.entries.filter((e: { scope: string }) => e.scope !== "SERVER_CLASS");
  assert.deepEqual(scopesOf(older).map((s) => s.id), ["ALL", "SERVER", "CLASS"]);
});

test("banner line: combat power over everyone seen, only when ranked and ready", () => {
  const data = fixture("character-rank.json").data;
  assert.deepEqual(bannerRank(data), {
    tier: "대양",
    label: "전투력",
    value: "5위 · 상위 12.5%",
    text: "전투력 5위 · 상위 12.5%",
    note: "LOAKraken이 최근 30일 안에 확인한 아이템 레벨 1,640 이상 캐릭터 기준 40명 중 순위예요. 공식 순위가 아니에요.",
  });
  assert.equal(bannerRank({ ...data, included: false, entries: [] }), null);
  const collecting = structuredClone(data);
  for (const entry of collecting.entries) entry.sampleStatus = "COLLECTING";
  assert.equal(bannerRank(collecting), null);
});

test("next tier (api #481): its name and the gap in the ranking's unit, none when there is none", () => {
  assert.equal(nextTierText({ nextTier: "TOP10", nextTierGap: 312.4 }, "COMBAT_POWER"), "심해까지 전투력 312.40");
  assert.equal(nextTierText({ nextTier: "TOP1", nextTierGap: 2.5 }, "ITEM_LEVEL"), "크라켄까지 아이템 레벨 2.50");
  // At the top, under the sample or too few for that tier: the backend sends null.
  assert.equal(nextTierText({ nextTier: null, nextTierGap: null }, "COMBAT_POWER"), null);
  // A response from before the fields, or a value the screen does not know.
  assert.equal(nextTierText({}, "COMBAT_POWER"), null);
  assert.equal(nextTierText({ nextTier: "TOP0", nextTierGap: 1 }, "COMBAT_POWER"), null);
  assert.equal(nextTierText({ nextTier: "TOP5", nextTierGap: 0 }, "COMBAT_POWER"), null);
});
