import assert from "node:assert/strict";
import test from "node:test";
import {
  classBuildTopKey,
  classBuildsKey,
  classBuildsPath,
  classBuildsSearch,
  fixCount,
  fixItems,
  hasFix,
  hiddenText,
  isClassBuildTopEnvelope,
  requestClassBuildTop,
  toggleFix,
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

test("fixes: read from the address (valid, unique, three at most), written back in a stable order", () => {
  const q = parseClassBuildsQuery(
    "블레이드",
    new URLSearchParams(
      "fixEngraving=원한&fixEngraving=원한&fixEngraving=<x>&fixTopStat=특화&fixEvolution=140&fixBracelet=치명&fixLeap=999&fixCardSet=세상을 구하는 빛",
    ),
  )!;
  // 원한 (once), 특화, 진화 140 — the fourth (the card set) and the bracelet are past three; 999 and <x> are not values.
  assert.deepEqual(q.fix, { engravings: ["원한"], bracelet: [], topStat: "특화", evolution: 140 });
  assert.equal(fixCount(q.fix), 3);
  assert.equal(
    classBuildsSearch(q).toString(),
    new URLSearchParams("fixEngraving=원한&fixTopStat=특화&fixEvolution=140").toString(),
  );
  assert.equal(parseClassBuildsQuery("블레이드", new URLSearchParams("fixTopStat=체력"))!.fix, undefined);
  // The key changes with the fixes; no fix and an empty fix are the same key.
  assert.notDeepEqual(classBuildsKey(q), classBuildsKey({ ...q, fix: undefined }));
  assert.deepEqual(classBuildsKey({ ...q, fix: undefined }), classBuildsKey({ ...q, fix: { engravings: [], bracelet: [] } }));
});

test("fixes: toggled on and off, never past three; each said in words", () => {
  let fix = toggleFix(undefined, { kind: "engraving", value: "원한" });
  fix = toggleFix(fix, { kind: "bracelet", value: "치명" });
  fix = toggleFix(fix, { kind: "cardSet", value: "세상을 구하는 빛" });
  assert.equal(fixCount(fix), 3);
  // A fourth changes nothing.
  assert.deepEqual(toggleFix(fix, { kind: "leap", value: 70 }), fix);
  assert.equal(hasFix(fix, { kind: "bracelet", value: "치명" }), true);
  assert.deepEqual(
    fixItems(fix).map((item) => item.label),
    ["원한", "세상을 구하는 빛", "팔찌 치명"],
  );
  // Freeing one makes room again.
  fix = toggleFix(fix, { kind: "engraving", value: "원한" });
  fix = toggleFix(fix, { kind: "evolution", value: 140 });
  assert.deepEqual(fixItems(fix).map((item) => item.label), ["진화 140", "세상을 구하는 빛", "팔찌 치명"]);
});

test("builds and top requests carry the conditions and fixes; an unknown fix's code passes through", async () => {
  const asked: string[] = [];
  let answer: { body: unknown; status: number } = { body: { code: "OTHER", message: "x", data: null }, status: 200 };
  const fetcher = (async (input: RequestInfo | URL) => {
    asked.push(String(input));
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }) as typeof fetch;
  const query = { className: "블레이드", activeDays: 30 as const, fix: { engravings: ["원한", "아드레날린"], bracelet: [], leap: 70 } };
  await requestClassBuilds(query, "http://backend.test", { fetcher });
  await requestClassBuildTop(query, "http://backend.test", { fetcher });
  const [builds, top] = asked.map((value) => new URL(value));
  assert.equal(decodeURIComponent(top.pathname), "/api/v1/stats/classes/블레이드/builds/top");
  for (const url of [builds, top]) {
    assert.deepEqual(url.searchParams.getAll("fixEngraving"), ["원한", "아드레날린"]);
    assert.equal(url.searchParams.get("fixLeap"), "70");
    assert.equal(url.searchParams.get("activeDays"), "30");
  }
  assert.deepEqual(classBuildTopKey(query).slice(1), classBuildsKey(query).slice(1));
  answer = { body: { code: "STATS_UNKNOWN_FIX", message: "", data: null }, status: 400 };
  const unknown = await requestClassBuilds(query, "http://backend.test", { fetcher });
  assert.deepEqual(unknown.ok ? null : [unknown.error.code, unknown.error.status], ["STATS_UNKNOWN_FIX", 400]);
  const top30 = {
    code: "STATS_CLASS_BUILDS_SUCCESS",
    message: "ok",
    data: {
      meta: {
        population: 120, conditions: { className: "블레이드", activeDays: 30, itemLevelMin: 1680 }, aggregatedAt: "2026-10-14T00:00:00Z",
        snapshot: "latest", ruleVersion: "class-builds-v1", minSample: 30, populationUnit: "CHARACTER", sampleStatus: "READY",
      },
      className: "블레이드", classEngraving: null, braceletItemLevelMin: 1680,
      rows: [{ rank: 1, characterName: "모험가", serverName: "아만", itemLevel: 1780.5, combatPower: 5200.25, observedAt: null }],
    },
  };
  assert.equal(isClassBuildTopEnvelope(top30), true);
  assert.equal(isClassBuildTopEnvelope({ ...top30, data: { ...top30.data, rows: [{ rank: 1 }] } }), false);
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
