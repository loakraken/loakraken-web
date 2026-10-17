import assert from "node:assert/strict";
import test from "node:test";
import { formatSavedRows, parseSavedRows } from "../lib/market/plan-address";
import type { PlanRow } from "../lib/market/store";

const row = (id: number, required: string, owned: string): PlanRow => ({
  item: { id } as PlanRow["item"],
  search: { categoryCode: 50010, itemName: "합성", pageNo: 1 },
  required,
  owned,
});

test("재료 견적 줄은 품목 id·검색 조건·필요·보유만 주소에 두고 그대로 읽는다", () => {
  const raw = formatSavedRows([row(66130141, "250", "30"), row(66130131, "", "0")]);
  assert.ok(raw);
  assert.deepEqual(parseSavedRows(raw), [
    { id: 66130141, c: 50010, n: "합성", p: 1, r: "250", o: "30" },
    { id: 66130131, c: 50010, n: "합성", p: 1, r: "", o: "0" },
  ]);
  assert.equal(formatSavedRows([]), null);
});

test("형식이 틀린 줄은 버리고, 10줄을 넘으면 앞의 10줄만", () => {
  assert.deepEqual(parseSavedRows("not json"), []);
  assert.deepEqual(parseSavedRows('{"id":1}'), []);
  const mixed = JSON.stringify([
    { id: 1, c: 2, n: "a", p: 1, r: "1", o: "0" },
    { id: "x", c: 2, n: "a", p: 1, r: "1", o: "0" },
    { id: 3, c: 2, n: "a".repeat(41), p: 1, r: "1", o: "0" },
    { id: 4, c: 2, n: "a", p: 0, r: "1", o: "0" },
  ]);
  assert.deepEqual(parseSavedRows(mixed).map((s) => s.id), [1]);
  const many = JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ id: i + 1, c: 2, n: "a", p: 1, r: "1", o: "0" })));
  assert.equal(parseSavedRows(many).length, 10);
});
