// 스펙업 목록의 종류 이름(PM 총괄 11-21 v0.3.15 목록 점검): 완갑 후보는 kind가 재련(EQUIPMENT_REFINE)이고 바꾸는 것이
// 완갑(ARM_GUARD)이라 '완갑'으로, 상급 재련(EQUIPMENT_ADVANCED_REFINE)은 '상급 재련'으로 부른다. 접힌 줄도 같다.
import assert from "node:assert/strict";
import test from "node:test";
import { candidateKindLabel, splitCandidates, type Candidate } from "../lib/spec-up/model";

const candidate = (id: string, kind: string, changeKind: string, status = "UNSUPPORTED") =>
  ({ id, kind, status, change: { kind: changeKind }, reasonCode: "MODEL_UNCONFIRMED", reason: "이유" }) as unknown as Candidate;

test("a 완갑 candidate (kind EQUIPMENT_REFINE, change ARM_GUARD) is named 완갑; others by kind", () => {
  assert.equal(candidateKindLabel(candidate("EQUIPMENT_REFINE:16:25", "EQUIPMENT_REFINE", "ARM_GUARD")), "완갑");
  assert.equal(candidateKindLabel(candidate("EQUIPMENT_REFINE:1:20", "EQUIPMENT_REFINE", "EQUIPMENT_REFINE")), "재련");
  assert.equal(candidateKindLabel(candidate("EQUIPMENT_ADVANCED_REFINE:1:21", "EQUIPMENT_ADVANCED_REFINE", "EQUIPMENT_ADVANCED_REFINE")), "상급 재련");
  assert.equal(candidateKindLabel({ kind: "SOMETHING_NEW" }), "기타");
});

test("the folded group names 완갑 rows 완갑, beside 재련 rows", () => {
  const { folded } = splitCandidates([
    candidate("EQUIPMENT_REFINE:16:25", "EQUIPMENT_REFINE", "ARM_GUARD"),
    candidate("EQUIPMENT_REFINE:1:20", "EQUIPMENT_REFINE", "EQUIPMENT_REFINE"),
  ]);
  assert.deepEqual(folded[0].kinds, ["완갑", "재련"]);
});
