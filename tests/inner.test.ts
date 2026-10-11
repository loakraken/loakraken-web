import assert from "node:assert/strict";
import test from "node:test";
import { AVATAR_SLOTS, avatarSlots } from "../lib/character/inner";

test("avatar slots: twelve in the game's order, worn items placed, empty ones null, others after", () => {
  const avatar = (type: string, name: string, isInner = false) =>
    ({ type, name, icon: null, grade: "영웅", isSet: false, isInner, effects: [] }) as Parameters<typeof avatarSlots>[0][number];
  const rows = avatarSlots([
    avatar("무기 아바타", "검"),
    avatar("무기 아바타", "검 덧입기", true),
    avatar("이동 효과", "폭풍우"),
    avatar("머리 덧입기 아바타", "모자"),
    avatar("특수 아바타", "기타 장식"),
  ]);
  assert.deepEqual(rows.slice(0, 12).map((row) => row.slot), [...AVATAR_SLOTS]);
  assert.equal(rows[0].avatar?.name, "검");
  assert.equal(rows[1].avatar?.name, "검 덧입기");
  assert.equal(rows[7].avatar?.name, "모자");
  assert.equal(rows[11].avatar?.name, "폭풍우");
  assert.equal(rows[2].avatar, null);
  assert.deepEqual(rows.slice(12).map((row) => [row.slot, row.avatar?.name]), [["특수", "기타 장식"]]);
});
