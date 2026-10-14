import assert from "node:assert/strict";
import test from "node:test";
import {
  classBuildsPath,
  classBuildsSearch,
  hiddenText,
  isClassBuildCellsEnvelope,
  isClassBuildsEnvelope,
  parseClassBuildCellsQuery,
  parseClassBuildsQuery,
  requestClassBuildCells,
  requestClassBuilds,
} from "../lib/stats/class-builds";
import { analysisLinks } from "../lib/character/analysis";

test("class builds query: class from the path, engraving and days from the address", () => {
  assert.deepEqual(parseClassBuildsQuery("블레이드", new URLSearchParams("")), {
    className: "블레이드",
    classEngraving: undefined,
    activeDays: 30,
  });
  const q = parseClassBuildsQuery("블레이드", new URLSearchParams("classEngraving=잔재된 기운&activeDays=7"))!;
  assert.deepEqual(q, { className: "블레이드", classEngraving: "잔재된 기운", activeDays: 7 });
  assert.equal(classBuildsSearch(q).toString(), new URLSearchParams("classEngraving=잔재된 기운&activeDays=7").toString());
  assert.equal(parseClassBuildsQuery("블레이드", new URLSearchParams("activeDays=14&classEngraving=<x>"))!.activeDays, 30);
  assert.equal(parseClassBuildsQuery("블레이드", new URLSearchParams("classEngraving=<x>"))!.classEngraving, undefined);
  assert.equal(parseClassBuildsQuery("blade<1>", new URLSearchParams("")), null);
  assert.equal(classBuildsPath("블레이드"), "/stats/classes/%EB%B8%94%EB%A0%88%EC%9D%B4%EB%93%9C");
  assert.match(classBuildsPath("블레이드", { classEngraving: "버스트" }), /\?classEngraving=%EB%B2%84%EC%8A%A4%ED%8A%B8$/);
});

test("hidden cells: people only where a character counts once", () => {
  assert.equal(hiddenText({ count: 31, share: 3.5 }, true), "표본이 적은 항목 31명은 숨김");
  // Engravings, bracelet stats and gems: the hidden sum is not people (PM-프론트 10-13).
  assert.equal(hiddenText({ count: 12, share: 1.4 }, false), "표본이 적은 항목은 숨김");
  assert.equal(hiddenText({ count: 0, share: null }, true), null);
  assert.equal(hiddenText(null, true), null);
});

test("class builds request: the class in the path, engraving and days as given", async () => {
  let asked = "";
  const fetcher = (async (input: RequestInfo | URL) => {
    asked = String(input);
    return new Response(JSON.stringify({ code: "OTHER", message: "x", data: null }), { status: 200 });
  }) as typeof fetch;
  await requestClassBuilds({ className: "블레이드", classEngraving: "버스트", activeDays: 7 }, "http://backend.test", { fetcher });
  const url = new URL(asked);
  assert.equal(decodeURIComponent(url.pathname), "/api/v1/stats/classes/블레이드/builds");
  assert.equal(url.searchParams.get("classEngraving"), "버스트");
  assert.equal(url.searchParams.get("activeDays"), "7");
  assert.equal(isClassBuildsEnvelope({ code: "OTHER", message: "x", data: null }), false);
});

const cellsBody = (overrides: Record<string, unknown> = {}) => ({
  code: "STATS_CLASS_BUILDS_SUCCESS",
  message: "ok",
  data: {
    characterName: "모험가", serverName: "아만", className: "블레이드", itemLevel: 1700.5,
    observedAt: "2026-10-14T00:00:00Z", source: "LIVE_CACHE", inSample: true, reasons: [],
    conditions: { itemLevelMin: 1680, itemLevelMax: null, activeDays: 30, braceletItemLevelMin: 1680 },
    cells: {
      classEngravings: { name: "버스트" },
      engravingCombos: { engravings: ["아드레날린", "원한"] },
      engravings: [{ name: "아드레날린" }, { name: "원한" }],
      arkPassivePoints: { evolution: { value: 140 }, enlightenment: null, leap: { value: 70 } },
      gems: { damage: [{ value: 10 }], cooldown: [] },
      cardSets: { set: "세상을 구하는 빛", pieces: 6, awakening: null },
      topStats: { name: "특화", tie: false },
      braceletEligible: false,
      braceletStats: null,
    },
    ruleVersion: "class-builds-v1",
    ...overrides,
  },
});

test("character cells query: a game name and the page's days, else nothing asked", () => {
  assert.deepEqual(parseClassBuildCellsQuery("블레이드", new URLSearchParams("characterName= 모험가 &activeDays=7")), {
    className: "블레이드",
    characterName: "모험가",
    activeDays: 7,
  });
  assert.equal(parseClassBuildCellsQuery("블레이드", new URLSearchParams("characterName=모험가"))!.activeDays, 30);
  assert.equal(parseClassBuildCellsQuery("블레이드", new URLSearchParams("characterName=모험가&activeDays=14")), null);
  assert.equal(parseClassBuildCellsQuery("블레이드", new URLSearchParams("characterName=<x>")), null);
  assert.equal(parseClassBuildCellsQuery("블레이드", new URLSearchParams("")), null);
  assert.equal(parseClassBuildCellsQuery("blade<1>", new URLSearchParams("characterName=모험가")), null);
});

test("character cells request: the path, the name and days; the answer checked against the contract", async () => {
  let asked = "";
  let answer: { body: unknown; status: number } = { body: cellsBody(), status: 200 };
  const fetcher = (async (input: RequestInfo | URL) => {
    asked = String(input);
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }) as typeof fetch;
  const query = { className: "블레이드", characterName: "모험가", activeDays: 7 as const };
  const ok = await requestClassBuildCells(query, "http://backend.test", { fetcher });
  const url = new URL(asked);
  assert.equal(decodeURIComponent(url.pathname), "/api/v1/stats/classes/블레이드/builds/character");
  assert.equal(url.searchParams.get("characterName"), "모험가");
  assert.equal(url.searchParams.get("activeDays"), "7");
  assert.equal(ok.ok, true);
  // A reason the web does not know yet is still a valid answer (strings, may grow).
  assert.equal(isClassBuildCellsEnvelope(cellsBody({ inSample: false, reasons: ["SOMETHING_NEW"] })), true);
  assert.equal(isClassBuildCellsEnvelope(cellsBody({ cells: null })), false);
  assert.equal(isClassBuildCellsEnvelope({ code: "OTHER", message: "x", data: cellsBody().data }), false);
  // Not cached: the code passes through as is (no official call behind it).
  answer = { body: { code: "CHARACTER_NOT_CACHED", message: "", data: null }, status: 404 };
  const missing = await requestClassBuildCells(query, "http://backend.test", { fetcher });
  assert.deepEqual(missing.ok ? null : [missing.error.code, missing.error.status], ["CHARACTER_NOT_CACHED", 404]);
});

test("분석 menu: 직업 통계 opens the character's class page with its class engraving", () => {
  const flags = { specUp: false, simulator: false, critSpeed: false };
  const link = analysisLinks("모험가", "아만", flags, { className: "블레이드", classEngraving: "버스트" }).find((l) => l.id === "class-stats")!;
  assert.equal(link.href, classBuildsPath("블레이드", { classEngraving: "버스트" }));
  assert.equal(link.description, "블레이드 버스트 인기 세팅 통계");
  // No class (an old record): the class table of the stats screen, as before.
  const old = analysisLinks("모험가", "아만", flags).find((l) => l.id === "class-stats")!;
  assert.equal(old.href, "/stats?tab=classes&server=%EC%95%84%EB%A7%8C");
});
