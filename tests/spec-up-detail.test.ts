import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isDetailEnvelope, isSpecUpEnvelope } from "../lib/spec-up/validate";
import { breathLabel, materialsTotal, refiningLink } from "../lib/spec-up/detail";

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
