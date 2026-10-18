import { test } from "node:test";
import assert from "node:assert/strict";
import { timeLeftText } from "../lib/accessory-search/time-left";

test("time left on an auction listing, from the minute clock", () => {
  const end = "2026-10-18T03:30:00+09:00";
  const at = (iso: string) => Date.parse(iso);
  assert.equal(timeLeftText(end, at("2026-10-18T00:18:00+09:00")), "3시간 12분 남음");
  assert.equal(timeLeftText(end, at("2026-10-16T03:30:00+09:00")), "2일 남음");
  assert.equal(timeLeftText(end, at("2026-10-17T02:29:00+09:00")), "1일 1시간 1분 남음");
  assert.equal(timeLeftText(end, at("2026-10-18T03:29:30+09:00")), "1분 안에 끝나요");
  assert.equal(timeLeftText(end, at("2026-10-18T03:31:00+09:00")), "판매 시간이 끝났어요");
});
