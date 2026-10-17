import assert from "node:assert/strict";
import test from "node:test";
import { analysisLinks } from "../lib/character/analysis";

const all = { specUp: true, simulator: true, critSpeed: true };

test("분석 menu: tabs of this page, then tools with the character filled in", () => {
  const links = analysisLinks("모험가", "아만", all);
  assert.deepEqual(
    links.map((link) => [link.label, link.href, link.tab ?? false]),
    [
      ["스펙업 계산", "?tab=specup", true],
      ["전투력 시뮬레이터", "?tab=simulator", true],
      ["치적·뭉가·음돌", "/tools/crit-speed?character=%EB%AA%A8%ED%97%98%EA%B0%80", false],
      ["캐릭터 비교", "/multi-search?names=%EB%AA%A8%ED%97%98%EA%B0%80", false],
      ["직업 통계", "/stats?tab=classes&server=%EC%95%84%EB%A7%8C", false],
    ],
  );
});

test("분석 menu: with the class known, the build comparison (M26) and the class page", () => {
  const links = analysisLinks("모험가", "아만", all, { className: "블레이드", classEngraving: "버스트" });
  const compare = links.find((link) => link.id === "build-compare");
  assert.equal(compare?.label, "대세 빌드 비교");
  assert.equal(
    compare?.href,
    `/stats/classes/${encodeURIComponent("블레이드")}?classEngraving=${encodeURIComponent("버스트")}&character=${encodeURIComponent("모험가")}`,
  );
  assert.deepEqual(links.slice(-2).map((link) => link.id), ["build-compare", "class-stats"]);
  // An old record without a class: no comparison, the stats screen's class table.
  assert.equal(analysisLinks("모험가", null, all).some((link) => link.id === "build-compare"), false);
});

test("분석 menu leaves out tools that are off, never shows them greyed", () => {
  const links = analysisLinks("모험가", null, { specUp: false, simulator: false, critSpeed: false });
  assert.deepEqual(links.map((link) => link.id), ["compare", "class-stats"]);
  assert.equal(links[1].href, "/stats?tab=classes");
});
