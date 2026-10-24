import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isDetailEnvelope, isSpecUpEnvelope } from "../lib/spec-up/validate";
import { breathLabel, materialsTotal, refiningLink } from "../lib/spec-up/detail";
import { requestSpecUpDetail } from "../lib/spec-up/upstream";
import { KRAKEN_NOTE_ALL, krakenUnavailableCopy, krakenUnavailableNote, listChangeCopy, splitKrakenCandidates } from "../lib/spec-up/model";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./spec-up-fixtures/${name}`, import.meta.url), "utf8"));

test("api #550 예시(보석·재련)는 줄 상세 계약을 통과하고, 404 예시는 통과하지 않는다", () => {
  assert.equal(isDetailEnvelope(fixture("character-spec-up-detail-gem.json")), true);
  assert.equal(isDetailEnvelope(fixture("character-spec-up-detail-refine.json")), true);
  assert.equal(isDetailEnvelope(fixture("character-spec-up-detail-not-found.json")), false);
});

test("빈 보석 칸 필드(#549)가 없는 이전 목록 응답도 계약을 통과한다(api 배포 전)", () => {
  const list = fixture("character-spec-up.json");
  for (const c of list.data.candidates) {
    delete c.emptySlot;
    delete c.baseAttackPctFrom;
    delete c.baseAttackPctTo;
  }
  assert.equal(isSpecUpEnvelope(list), true);
  const withFields = fixture("character-spec-up.json");
  Object.assign(withFields.data.candidates[0], { emptySlot: true, baseAttackPctFrom: 0, baseAttackPctTo: 1 });
  assert.equal(isSpecUpEnvelope(withFields), true);
});

test("재련 예시: 재료 합 + 재련 골드는 목록 비용과 1골드 안쪽, 링크는 캐릭터 이름으로", () => {
  const { data } = fixture("character-spec-up-detail-refine.json");
  const total = materialsTotal(data);
  assert.ok(total != null);
  if (data.candidate.cost?.amount != null) assert.ok(Math.abs(Math.ceil(total) - data.candidate.cost.amount) <= 1);
  assert.equal(refiningLink("재련", data.refine), "/tools/refining?character=%EC%9E%AC%EB%A0%A8");
  assert.equal(refiningLink("재련", null), null);
  assert.equal(breathLabel("NONE"), "숨결 안 씀");
  assert.equal(breathLabel("NEW_VALUE"), "NEW_VALUE");
  assert.equal(breathLabel(null), null);
});

test("각인 줄 id(한글·공백)는 받아서 %20으로 보내고, 형식이 다른 id는 요청 없이 막는다", async () => {
  const seen: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return new Response(JSON.stringify(fixture("character-spec-up-detail-engraving.json")), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const ok = await requestSpecUpDetail("스펙캐시", "ENGRAVING_LEVEL:기습의 대가:4", "http://api.test", { fetcher });
  assert.equal(ok.ok, true);
  assert.ok(seen[0].includes("%20"), seen[0]);
  assert.ok(!seen[0].includes("+"), seen[0]);
  for (const bad of ["gem:1", "GEM_LEVEL:../x", "GEM_LEVEL:a/b", ""]) {
    const res = await requestSpecUpDetail("스펙캐시", bad, "http://api.test", { fetcher });
    assert.equal(res.ok, false, bad);
  }
  assert.equal(seen.length, 1);
});

test("크라켄 점수 순: 점수 변화가 있는 후보는 상태와 상관없이 응답 순서대로 순위에, 나머지는 이유별로 접힌다", () => {
  const { data } = fixture("character-spec-up-kraken.json");
  const { ok, folded } = splitKrakenCandidates(data.candidates);
  assert.equal(ok.length, 35);
  assert.equal(ok[0].id, "GEM_LEVEL:0:7");
  assert.ok(ok.some((c: { status: string }) => c.status === "UNSUPPORTED"));
  assert.equal(folded.reduce((n: number, f: { candidates: unknown[] }) => n + f.candidates.length, 0), 6);
  assert.equal(krakenUnavailableCopy(null), null);
  assert.equal(krakenUnavailableCopy("DISABLED"), "크라켄 점수 순은 아직 준비 중이에요. 1만 골드당 효율 순으로 보여 드려요.");
  assert.match(krakenUnavailableCopy("NEW_REASON") ?? "", /정렬할 수 없어요/);
  // #921: one sentence for another list (sort, or the same sort's cooldown choice).
  assert.equal(listChangeCopy("EFFICIENCY:", "KRAKEN", false), "크라켄 점수 순으로 정렬했어요");
  assert.equal(listChangeCopy("KRAKEN:false", "EFFICIENCY", true), "1만 골드당 효율 순으로 정렬했어요");
  assert.equal(listChangeCopy("KRAKEN:false", "KRAKEN", true), "작열 보석을 넣어 다시 정렬했어요");
  assert.equal(listChangeCopy("KRAKEN:true", "KRAKEN", false), "작열 보석을 빼고 다시 정렬했어요");
  // The short note in the bar; its slot holds the room of every note.
  assert.equal(krakenUnavailableNote(null), null);
  assert.equal(krakenUnavailableNote("DISABLED"), "점수 정렬 준비 중 · 효율 순");
  assert.equal(krakenUnavailableNote("NEW_REASON"), "지금은 점수 정렬 불가 · 효율 순");
  for (const r of ["DISABLED", "INPUT_PENDING", "ROLE_UNKNOWN", "SUPPORTER_PENDING", "SCORE_UNAVAILABLE", "NEW_REASON"])
    assert.ok(KRAKEN_NOTE_ALL.includes(krakenUnavailableNote(r) ?? ""), r);
});
