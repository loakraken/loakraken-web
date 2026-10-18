// 재료 구매 견적 분류(v0.3.2 사용자 결정): 매물이 없는 공식 분류 두 개(장비 상자 10100, 보석 상자
// 220000)만 코드로 빼고, 아바타 등 나머지는 그대로 둔다.
import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_MARKET_CATEGORIES, quoteCategories, type MarketCategory } from "../lib/market/model";

const category = (code: number, codeName: string, subs: { code: number; codeName: string }[] = []) =>
  ({ code, codeName, subs }) as MarketCategory;

test("only 장비 상자 and 보석 상자 leave the list, by code; the rest keep their order", () => {
  const all = [
    category(10100, "장비 상자"),
    category(20000, "아바타", [{ code: 20005, codeName: "무기" }]),
    category(50000, "재료", [{ code: 50010, codeName: "강화 재료" }]),
    category(220000, "보석 상자"),
    category(60000, "소모품"),
  ];
  assert.deepEqual(
    quoteCategories(all).map((c) => c.code),
    [20000, 50000, 60000],
  );
  assert.deepEqual([...EMPTY_MARKET_CATEGORIES], [10100, 220000]);
  // By code, not name: a renamed box still leaves, another '상자' stays.
  assert.deepEqual(
    quoteCategories([category(10100, "이름이 바뀐 분류"), category(90000, "상자")]).map((c) => c.code),
    [90000],
  );
  assert.deepEqual(quoteCategories([]), []);
});
