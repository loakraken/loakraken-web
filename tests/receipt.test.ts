import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  coverageText,
  excludedLabel,
  excludedSummary,
  includedText,
  isReceiptEnvelope,
  isReceiptOff,
  memberState,
  nextRefreshDelay,
  notIncludedText,
  observedText,
  requestReceipt,
  rowMarker,
  totalStatus,
  unavailableCount,
} from "../lib/character/receipt";

const fixture = () =>
  JSON.parse(readFileSync(new URL("./receipt-fixtures/character-receipt.json", import.meta.url), "utf8"));

test("backend sample satisfies the captured contract; unknown reasons keep the receipt", () => {
  assert.equal(isReceiptEnvelope(fixture()), true);
  const newer = fixture();
  newer.data.equipment.characters[0].excluded.push({ slot: null, name: null, reason: "SOMETHING_NEW", message: "새 사유" });
  assert.equal(isReceiptEnvelope(newer), true);
  const broken = fixture();
  broken.data.computedAt = "어제";
  assert.equal(isReceiptEnvelope(broken), false);
});

test("labels and sentences never show codes", () => {
  const data = fixture().data;
  assert.equal(includedText(data), "장비 재련 · 보석");
  // Empty kinds drop out; nothing left hides the line (PM #294).
  assert.equal(notIncludedText(data), "");
  const some = structuredClone(data);
  some.notIncluded[1].count = 5;
  assert.equal(notIncludedText(some), "팔찌 5 (산정 기준 검증 중)");
  assert.equal(coverageText(data), "원정대 10명 중 8명 계산 · 2명 대기");
  assert.equal(excludedLabel("ARM_GUARD"), "완갑 제외");
  assert.equal(excludedLabel("GROWTH_COST_UNCONFIRMED"), "성장 비용 미확정 단계 제외");
  assert.equal(excludedLabel("LIMIT_BREAK_UNPRICED"), "한계 해방 비용 미산정");
  assert.equal(excludedLabel("SOMETHING_NEW"), "알 수 없음");
  const done = structuredClone(data);
  done.coverage = { ...done.coverage, ready: 10, pending: 0 };
  assert.equal(coverageText(done), "원정대 10명 중 10명 계산");
});

test("the total follows total.status (backend #665): partial and unavailable are never shown as a full sum", () => {
  const data = fixture().data;
  assert.equal(totalStatus(data), "PARTIAL");
  const complete = structuredClone(data);
  complete.total.status = "COMPLETE";
  assert.equal(totalStatus(complete), "COMPLETE");
  const none = structuredClone(data);
  none.total = { ...none.total, gold: 0, status: "UNAVAILABLE" };
  assert.equal(totalStatus(none), "UNAVAILABLE");
  // The backend's word wins over the facts in either direction.
  const said = structuredClone(data);
  said.total.status = "UNAVAILABLE";
  assert.equal(totalStatus(said), "UNAVAILABLE");
  // A value this screen does not know: never read as complete.
  const unknown = structuredClone(data);
  unknown.total.status = "SOMETHING_NEW";
  unknown.coverage.pending = 0;
  assert.equal(isReceiptEnvelope({ ...fixture(), data: unknown }), true);
  assert.equal(totalStatus(unknown), "PARTIAL");
  unknown.total.gold = 0;
  assert.equal(totalStatus(unknown), "UNAVAILABLE");
});

test("without total.status (a backend before #665) the status comes from coverage, rows and gems", () => {
  const old = fixture().data;
  delete old.total.status;
  for (const row of old.equipment.characters) delete row.complete;
  assert.equal(isReceiptEnvelope({ ...fixture(), data: old }), true);
  // Two characters pending.
  assert.equal(totalStatus(old), "PARTIAL");
  const all = structuredClone(old);
  all.coverage = { ...all.coverage, ready: 10, pending: 0 };
  assert.equal(totalStatus(all), "COMPLETE");
  const unpriced = structuredClone(all);
  unpriced.gems.unpriced = 1;
  assert.equal(totalStatus(unpriced), "PARTIAL");
  const part = structuredClone(all);
  part.equipment.characters[0].complete = false;
  assert.equal(totalStatus(part), "PARTIAL");
  part.total.gold = 0;
  assert.equal(totalStatus(part), "UNAVAILABLE");
});

test("what the total leaves out is summed per reason; rows carry a marker", () => {
  const data = fixture().data;
  // 8 ready characters, each without the arm guard and advanced refining; 2 pending.
  assert.equal(excludedSummary(data), "계산 대기 2명 · 완갑 제외 8 · 상급 재련 미산정 8");
  const more = structuredClone(data);
  more.coverage.pending = 0;
  more.equipment.characters[0].excluded.push({ slot: "투구", name: null, reason: "PRICE_UNAVAILABLE", message: "x" });
  more.gems.unpriced = 3;
  assert.equal(excludedSummary(more), "완갑 제외 8 · 상급 재련 미산정 8 · 시세 없음 1 · 보석 환산 못 함 3개");
  const clean = structuredClone(more);
  clean.gems.unpriced = 0;
  for (const row of clean.equipment.characters) row.excluded = [];
  assert.equal(excludedSummary(clean), "");

  const [ready] = data.equipment.characters;
  assert.deepEqual(rowMarker(ready), { partial: false, text: "제외 2" });
  assert.deepEqual(rowMarker({ ...ready, complete: false }), { partial: true, text: "일부" });
  assert.equal(rowMarker({ ...ready, excluded: [] }), null);
  assert.equal(rowMarker(data.equipment.characters[9]), null);
});

test("receipt off is a 404 that is not 'character not found'", () => {
  assert.equal(isReceiptOff({ code: "LOST_ARK_API_ERROR", status: 404 }), true);
  assert.equal(isReceiptOff({ code: "CHARACTER_NOT_FOUND", status: 404 }), false);
  assert.equal(isReceiptOff({ code: "LOST_ARK_RATE_LIMITED", status: 429 }), false);
  assert.equal(isReceiptOff(null), false);
});

test("receipt requests always say assumeBook (true or false) and allow-list errors", async () => {
  const urls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return Response.json(fixture());
  }) as unknown as typeof fetch;
  assert.equal((await requestReceipt("영수증본캐", false, "http://127.0.0.1:8080", { fetcher })).ok, true);
  assert.equal((await requestReceipt("영수증본캐", true, "http://127.0.0.1:8080", { fetcher })).ok, true);
  assert.equal(new URL(urls[0]).searchParams.get("assumeBook"), "false");
  assert.equal(new URL(urls[1]).searchParams.get("assumeBook"), "true");
  assert.equal((await requestReceipt("a b", false, "http://127.0.0.1:8080", { fetcher })).ok, false);
  assert.equal(urls.length, 2);
  const limited = (async () =>
    Response.json({ code: "CLIENT_RATE_LIMITED", message: "x" }, { status: 429, headers: { "Retry-After": "30" } })) as unknown as typeof fetch;
  const result = await requestReceipt("영수증본캐", false, "http://127.0.0.1:8080", { fetcher: limited });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "LOST_ARK_RATE_LIMITED");
    assert.ok(result.error.retryAt);
  }
});

test("receipt fan-out: unavailable members are named, never pending, and the panel fills the rest by itself", () => {
  const data = fixture().data;
  // A member the backend could not find (status UNAVAILABLE, coverage.unavailable).
  const some = structuredClone(data);
  some.equipment.characters[9].status = "UNAVAILABLE";
  some.coverage = { ...some.coverage, pending: 1, unavailable: 1 };
  assert.equal(isReceiptEnvelope({ ...fixture(), data: some }), true);
  assert.equal(unavailableCount(some), 1);
  assert.equal(coverageText(some), "원정대 10명 중 8명 계산 · 1명 대기 · 1명 확인 못 함");
  assert.equal(coverageText(some, true), "원정대 10명 중 8명 계산 · 1명 갱신 중 · 1명 확인 못 함");
  assert.match(excludedSummary(some), /^계산 대기 1명 · 확인 못 함 1명/);
  assert.equal(rowMarker(some.equipment.characters[9]), null);
  // Without coverage.unavailable (older answer shape) the rows are counted.
  const rows = structuredClone(some);
  delete rows.coverage.unavailable;
  assert.equal(unavailableCount(rows), 1);
  // Nobody left out and nothing pending: the total is complete; one unavailable member makes it partial.
  const old = structuredClone(some);
  delete old.total.status;
  old.coverage.pending = 0;
  assert.equal(totalStatus(old), "PARTIAL");

  // When to ask again: the backend's time first, never sooner than 6 s (2 official
  // calls per 6 s = the 20 per minute a visitor may make), never once stopped or done.
  const now = Date.parse("2026-10-25T10:00:00Z");
  const waiting = structuredClone(data);
  waiting.coverage.nextAvailableAt = new Date(now).toISOString();
  assert.equal(nextRefreshDelay(waiting, now, false), 6_000);
  waiting.coverage.nextAvailableAt = new Date(now + 60_000).toISOString();
  assert.equal(nextRefreshDelay(waiting, now, false), 60_000);
  waiting.coverage.nextAvailableAt = null;
  assert.equal(nextRefreshDelay(waiting, now, false), 6_000);
  assert.equal(nextRefreshDelay(waiting, now, true), null);
  waiting.coverage.pending = 0;
  assert.equal(nextRefreshDelay(waiting, now, false), null);

  // How old a member's equipment is.
  assert.equal(observedText(null, now), null);
  assert.equal(observedText(new Date(now - 20_000).toISOString(), now), "방금 기준");
  assert.equal(observedText(new Date(now - 5 * 60_000).toISOString(), now), "5분 전 기준");
  assert.equal(observedText(new Date(now - 3 * 3_600_000).toISOString(), now), "3시간 전 기준");
  assert.equal(observedText(new Date(now - 2 * 86_400_000).toISOString(), now), "2일 전 기준");
});

test("a member status this screen does not know reads as '확인 못 함': not pending, counted, no marker, the receipt still passes", () => {
  const data = fixture().data;
  const row = data.equipment.characters.find((c: { status: string }) => c.status === "READY");
  row.status = "SOMETHING_NEW";
  assert.equal(isReceiptEnvelope({ ...fixture(), data }), true);
  assert.equal(memberState(row), "UNAVAILABLE");
  assert.equal(rowMarker(row), null);
  assert.equal(unavailableCount(data), 1);
  assert.match(coverageText(data), /1명 확인 못 함$/);
  assert.match(excludedSummary(data), /확인 못 함 1명/);
  // The backend's own count of UNAVAILABLE rows never hides an unknown one.
  data.coverage.unavailable = 0;
  assert.equal(unavailableCount(data), 1);
  data.coverage.unavailable = 3;
  assert.equal(unavailableCount(data), 3);
  for (const status of ["READY", "PENDING", "UNAVAILABLE"]) assert.equal(memberState({ ...row, status }), status);
});