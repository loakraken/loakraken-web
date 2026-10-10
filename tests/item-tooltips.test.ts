import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { equipmentLines, isItemTooltipsEnvelope, lineTone, requestItemTooltips } from "../lib/character/item-tooltips";

const sample = () =>
  JSON.parse(readFileSync(new URL("./item-tooltips-fixtures/character-item-tooltips.json", import.meta.url), "utf8"));

test("backend-generated item tooltip lines satisfy the contract", () => {
  assert.equal(isItemTooltipsEnvelope(sample()), true);
  assert.equal(isItemTooltipsEnvelope({ ...sample(), code: "CHARACTER_SEARCH_SUCCESS" }), false);
});

test("equipment lines join the search response by index and type", () => {
  const data = sample().data;
  assert.deepEqual(equipmentLines(data, 1, "귀걸이"), ["내구도 62 / 175"]);
  // A newer search reordered the items: a type mismatch shows no stale lines.
  assert.deepEqual(equipmentLines(data, 1, "목걸이"), []);
  assert.deepEqual(equipmentLines(data, 0, "투구"), []);
  assert.deepEqual(equipmentLines(undefined, 1, "귀걸이"), []);
});

test("line colours follow the official tooltip", () => {
  assert.equal(lineTone("분해불가"), "warn");
  assert.equal(lineTone("판매불가, 파괴불가, 분해불가"), "warn");
  assert.equal(lineTone("[제작] 대도시"), "craft");
  assert.equal(lineTone("내구도 61 / 66"), "plain");
});

test("item tooltip request checks the name before calling the backend", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: URL | RequestInfo) => {
    calls.push(String(input));
    return Response.json(sample());
  }) as typeof fetch;
  assert.equal((await requestItemTooltips("상세!", "http://127.0.0.1:8080", { fetcher })).ok, false);
  assert.equal(calls.length, 0);
  assert.equal((await requestItemTooltips("상세", "http://127.0.0.1:8080", { fetcher })).ok, true);
  assert.match(calls[0], /\/api\/v1\/characters\/item-tooltips\?characterName=/);
});
