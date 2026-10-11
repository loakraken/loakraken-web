import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  equipmentExtra,
  equipmentLines,
  isItemTooltipsEnvelope,
  lineTone,
  placeExtraLines,
  requestItemTooltips,
} from "../lib/character/item-tooltips";

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

test("remaining lines group into the reference site's sections", async () => {
  const { groupExtraLines } = await import("../lib/character/item-tooltips");
  assert.deepEqual(groupExtraLines(["분해불가", "[제작] 대도시", "내구도 61 / 66"]), [["분해불가"], ["[제작] 대도시"], ["내구도 61 / 66"]]);
  assert.deepEqual(
    groupExtraLines(["효과 부여 불가", "[가디언 토벌] 스콜라키아", "[카제로스 레이드] 1막", "그 외에 획득처가 더 존재합니다."]),
    [["효과 부여 불가"], ["[가디언 토벌] 스콜라키아", "[카제로스 레이드] 1막", "그 외에 획득처가 더 존재합니다."]],
  );
  assert.deepEqual(
    groupExtraLines(["빛나는 황금을 이용해 만들어진 고급 나침반.", "수십 년을 사용해도 녹 하나 슬지 않는다고 전해진다.", "판매불가, 파괴불가", "[제작] 외로운 섬"]),
    [["빛나는 황금을 이용해 만들어진 고급 나침반.", "수십 년을 사용해도 녹 하나 슬지 않는다고 전해진다."], ["판매불가, 파괴불가"], ["[제작] 외로운 섬"]],
  );
});

test("a backend before #286 (no section titles) still passes and keeps the lines at the end", () => {
  const old = sample();
  for (const item of old.data.equipment) delete item.extraLineSections;
  assert.equal(isItemTooltipsEnvelope(old), true);
  const extra = equipmentExtra(old.data, 1, "귀걸이");
  assert.deepEqual(extra.sections, []);
  assert.deepEqual(placeExtraLines(extra, new Set(["팔찌 효과"])).tail, extra.lines);
});

test("a line that followed an earlier section goes right after it", () => {
  // The bracelet as the official tooltip has it (local backend, 언새늘).
  const bracelet = {
    lines: ["효과 부여 불가", "[가디언 토벌] 스콜라키아", "그 외에 획득처가 더 존재합니다."],
    sections: ["팔찌 효과", "아크 패시브 포인트 효과", "아크 패시브 포인트 효과"],
  };
  const placed = placeExtraLines(bracelet, new Set(["팔찌 효과", "아크 패시브 포인트 효과"]));
  assert.deepEqual(placed.after.get("팔찌 효과"), ["효과 부여 불가"]);
  assert.deepEqual(placed.tail, ["[가디언 토벌] 스콜라키아", "그 외에 획득처가 더 존재합니다."]);
  // A section the card does not show, or a length mismatch: the end, in order.
  assert.deepEqual(placeExtraLines(bracelet, new Set(["아크 패시브 포인트 효과"])).tail, bracelet.lines);
  assert.deepEqual(placeExtraLines({ ...bracelet, sections: ["팔찌 효과"] }, new Set(["팔찌 효과"])).tail, bracelet.lines);
});
