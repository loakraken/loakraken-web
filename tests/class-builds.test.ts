import assert from "node:assert/strict";
import test from "node:test";
import {
  classBuildsPath,
  classBuildsSearch,
  hiddenText,
  isClassBuildsEnvelope,
  parseClassBuildsQuery,
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

test("분석 menu: 직업 통계 opens the character's class page with its class engraving", () => {
  const flags = { specUp: false, simulator: false, critSpeed: false };
  const link = analysisLinks("모험가", "아만", flags, { className: "블레이드", classEngraving: "버스트" }).find((l) => l.id === "class-stats")!;
  assert.equal(link.href, classBuildsPath("블레이드", { classEngraving: "버스트" }));
  assert.equal(link.description, "블레이드 버스트 인기 세팅 통계");
  // No class (an old record): the class table of the stats screen, as before.
  const old = analysisLinks("모험가", "아만", flags).find((l) => l.id === "class-stats")!;
  assert.equal(old.href, "/stats?tab=classes&server=%EC%95%84%EB%A7%8C");
});
