// 크라켄 점수 목록에서 순위에 넣을 수 없는 줄(PM 총괄 11-21, v0.3.15): api가 계산했지만(OK) Δ점수가 없는 줄
// (빈 보석 칸)은 순위에도 접힌 줄에도 없어 화면에서 사라졌다. 이제 쉬운 문장으로 접히고, 어떤 줄도 빠지지 않는다.
// 표본: 계산 검증의 실제 limit=50 답(이름 가림, 실목록1).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  KRAKEN_UNSCORED,
  KRAKEN_UNSCORED_REASON,
  krakenRanked,
  splitCandidates,
  splitKrakenCandidates,
  type Candidate,
} from "../lib/spec-up/model";

const answer = (name: string) =>
  JSON.parse(readFileSync(new URL(`./spec-up-fixtures/v0315-list/${name}.json`, import.meta.url), "utf8")).data as {
    total: number;
    candidates: Candidate[];
  };

test("실목록1 크라켄 점수: no row is left off the screen (ranked + folded = the answer)", () => {
  const { candidates } = answer("실목록1-KRAKEN");
  const { ok, folded } = splitKrakenCandidates(candidates);
  const shown = [...ok, ...folded.flatMap((g) => g.candidates)].map((c) => c.id).sort();
  assert.deepEqual(shown, candidates.map((c) => c.id).sort());
});

test("실목록1 크라켄 점수: the 5 OK 빈 보석 칸 rows with no Δ점수 fold with the plain sentence", () => {
  const { candidates } = answer("실목록1-KRAKEN");
  const group = splitKrakenCandidates(candidates).folded.find((g) => g.code === KRAKEN_UNSCORED);
  assert.ok(group, "a fold for the unscored rows");
  assert.equal(group.reason, KRAKEN_UNSCORED_REASON);
  assert.deepEqual(group.kinds, ["보석"]);
  assert.deepEqual(
    group.candidates.map((c) => `${c.target} ${c.from} → ${c.to}`),
    // The fold's fixed order is by id (GEM_LEVEL:0:10 before :0:6), as every fold.
    ["10", "6", "7", "8", "9"].map((level) => `빈 보석 칸 11개 빈 칸 → ${level}레벨 겁화`),
  );
});

test("실목록1 크라켄 점수: the api's total is the ranked rows that came back (nothing was cut)", () => {
  const { total, candidates } = answer("실목록1-KRAKEN");
  assert.equal(candidates.filter(krakenRanked).length, total);
  assert.equal(splitKrakenCandidates(candidates).ok.length, 36);
});

test("an api reason wins over the plain one; a scored row that is not OK is still ranked", () => {
  const row = (id: string, status: string, deltaKrakenScore: number | null, reasonCode: string | null = null) =>
    ({ id, kind: "GEM_LEVEL", status, deltaKrakenScore, reasonCode, reason: reasonCode ? "api 문장" : null }) as unknown as Candidate;
  const { ok, folded } = splitKrakenCandidates([
    row("a", "UNSUPPORTED", 1.2, "MODEL_UNCONFIRMED"),
    row("b", "OK", null),
    row("c", "UNSUPPORTED", null, "MODEL_UNCONFIRMED"),
  ]);
  assert.deepEqual(ok.map((c) => c.id), ["a"]);
  assert.deepEqual(folded.map((g) => [g.code, g.reason, g.candidates.map((c) => c.id)]), [
    ["MODEL_UNCONFIRMED", "api 문장", ["c"]],
    [KRAKEN_UNSCORED, KRAKEN_UNSCORED_REASON, ["b"]],
  ]);
});

test("효율 · 증가 lists are unchanged: OK rows ranked, the rest folded by the api's reason", () => {
  const { candidates } = answer("실목록1-EFFICIENCY");
  const { ok, folded } = splitCandidates(candidates);
  assert.deepEqual(ok, candidates.filter((c) => c.status === "OK"));
  assert.ok(folded.every((g) => g.code !== KRAKEN_UNSCORED));
});
