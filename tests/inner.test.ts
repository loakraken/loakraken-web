import assert from "node:assert/strict";
import test from "node:test";
import { AVATAR_SLOTS, avatarSlots, rarestOwned } from "../lib/character/inner";

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

test("가장 희귀한 보유: lowest share among finished items, unknown shares left out", () => {
  const item = (name: string, point: number, maxPoint: number) => ({ name, point, maxPoint });
  const items = [item("가", 1, 1), item("나", 1, 1), item("다", 0, 1), item("라", 5, 5), item("마", 1, 1)];
  const shares: Record<string, number> = { 가: 40.2, 나: 3.1, 다: 0.4, 라: 3.1 };
  const shareOf = (name: string | null) => (name ? shares[name] ?? null : null);
  // 다 is rarer but not finished; 라 ties 나 later in the list; 마 has no share.
  assert.deepEqual(rarestOwned(items as never, shareOf), { name: "나", share: 3.1 });
  assert.equal(rarestOwned([item("다", 0, 1)] as never, shareOf), null);
});
