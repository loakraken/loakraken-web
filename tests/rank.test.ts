import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TIER_LABEL,
  TIER_LEGEND,
  conditionsText,
  isRankEnvelope,
  rankCell,
  rankState,
  requestRank,
  scopeLabel,
} from "../lib/character/rank";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./rank-fixtures/${name}`, import.meta.url), "utf8"));

test("backend samples (ranked, hidden) satisfy the captured contract", () => {
  assert.equal(isRankEnvelope(fixture("character-rank.json")), true);
  assert.equal(isRankEnvelope(fixture("character-rank-hidden.json")), true);
  const broken = fixture("character-rank.json");
  broken.data.entries[0].rank = "5위";
  assert.equal(isRankEnvelope(broken), false);
  // A tier added later keeps the response; that cell just shows no badge.
  const newer = fixture("character-rank.json");
  newer.data.entries[0].tier = "TOP3";
  assert.equal(isRankEnvelope(newer), true);
  assert.equal((rankCell(newer.data, "COMBAT_POWER", "ALL") as { tier: string | null }).tier, null);
});

test("HIDDEN wins over everything; not included shows dashes, not zeros", () => {
  const hidden = fixture("character-rank-hidden.json").data;
  assert.equal(rankState(hidden), "hidden");
  // Even if other fields looked rankable, HIDDEN still hides.
  assert.equal(rankState({ ...hidden, included: true, entries: fixture("character-rank.json").data.entries }), "hidden");
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
    tierNote: "LOAKraken이 확인한 캐릭터 중 상위 25% 이내",
  });
  const collecting = structuredClone(data);
  collecting.entries[2] = { ...collecting.entries[2], sampleStatus: "COLLECTING", topPercent: null, tier: null };
  assert.deepEqual(rankCell(collecting, "COMBAT_POWER", "CLASS"), { state: "collecting", total: 35 });
  assert.equal(TIER_LEGEND, "크라켄 상위 1% · 해구 5% · 심해 10% · 대양 25% · 연안 50%");
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
