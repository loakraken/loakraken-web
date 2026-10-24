import assert from "node:assert/strict";
import test from "node:test";
import { priceUnavailableCopy } from "../lib/market/model";

test("시세 없음 사유(api #600): 한도에 걸린 것만 '잠시 뒤 다시', 그 밖·없음·모르는 값은 '가격 없음'", () => {
  const retry = "지금은 못 불러왔어요 · 잠시 뒤 다시 불러와요";
  const none = "선택한 기준의 가격이 없어요";
  assert.equal(priceUnavailableCopy("RATE_LIMITED"), retry);
  assert.equal(priceUnavailableCopy("SEARCH_LIMIT"), retry);
  assert.equal(priceUnavailableCopy("OFFICIAL_UNAVAILABLE"), none);
  assert.equal(priceUnavailableCopy(null), none);
  assert.equal(priceUnavailableCopy(undefined), none);
  assert.equal(priceUnavailableCopy("NEW_REASON"), none);
});
