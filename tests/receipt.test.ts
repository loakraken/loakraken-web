import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  coverageText,
  excludedLabel,
  includedText,
  isReceiptEnvelope,
  isReceiptOff,
  notIncludedText,
  requestReceipt,
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

test("receipt off is a 404 that is not 'character not found'", () => {
  assert.equal(isReceiptOff({ code: "LOST_ARK_API_ERROR", status: 404 }), true);
  assert.equal(isReceiptOff({ code: "CHARACTER_NOT_FOUND", status: 404 }), false);
  assert.equal(isReceiptOff({ code: "LOST_ARK_RATE_LIMITED", status: 429 }), false);
  assert.equal(isReceiptOff(null), false);
});

test("receipt requests pass assumeBook only when on and allow-list errors", async () => {
  const urls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return Response.json(fixture());
  }) as unknown as typeof fetch;
  assert.equal((await requestReceipt("영수증본캐", false, "http://127.0.0.1:8080", { fetcher })).ok, true);
  assert.equal((await requestReceipt("영수증본캐", true, "http://127.0.0.1:8080", { fetcher })).ok, true);
  assert.ok(!new URL(urls[0]).searchParams.has("assumeBook"));
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
