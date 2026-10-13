import assert from "node:assert/strict";
import test from "node:test";
import { indexableSummary, isPublicSummaryEnvelope, isSearchBot, summaryLine } from "../lib/character/public-summary";
import { isCharacterIndexingEnabled } from "../lib/tools/flags";
import { PRODUCTION_URL } from "../lib/site";

const summary = {
  characterName: "공개요약",
  serverName: "아만",
  className: "블레이드",
  characterLevel: 70,
  itemLevel: 1770,
  combatPower: 4000,
  arkPassiveTitle: "버스트",
  observedAt: "2026-10-12T03:00:00Z",
  dataSource: "STORED_OBSERVATION" as const,
  indexable: true,
};
const ok = (data: typeof summary) => ({ ok: true as const, envelope: { code: "CHARACTER_PUBLIC_SUMMARY_SUCCESS", message: "ok", data } });

test("indexing is off unless CHARACTER_INDEXING=on, on every deployment", () => {
  assert.equal(isCharacterIndexingEnabled({}), false);
  assert.equal(isCharacterIndexingEnabled({ SITE_URL: PRODUCTION_URL }), false);
  assert.equal(isCharacterIndexingEnabled({ CHARACTER_INDEXING: "on" }), true);
  assert.equal(isCharacterIndexingEnabled({ CHARACTER_INDEXING: "yes" }), false);
});

test("only an indexable summary with indexing on is indexed; everything else reads the same (B5)", () => {
  assert.deepEqual(indexableSummary(true, ok(summary)), summary);
  assert.equal(indexableSummary(false, ok(summary)), null);
  // Not indexable (roster list only, or a processing-stop character in the live cache) …
  assert.equal(indexableSummary(true, ok({ ...summary, indexable: false })), null);
  // … not cached (never recorded, or a processing-stop character in stored records) …
  assert.equal(indexableSummary(true, { ok: false, error: { code: "CHARACTER_NOT_CACHED", status: 404 } }), null);
  // … and a failure all give the same nothing.
  assert.equal(indexableSummary(true, { ok: false, error: { code: "CHARACTER_STORAGE_UNAVAILABLE", status: 503 } }), null);
  assert.equal(indexableSummary(true, null), null);
});

test("summary line and contract", () => {
  assert.equal(summaryLine(summary), "아만 · 블레이드 · 아이템 레벨 1,770 · 전투력 4,000 · 버스트");
  assert.equal(summaryLine({ ...summary, serverName: null, combatPower: null, arkPassiveTitle: null }), "블레이드 · 아이템 레벨 1,770");
  assert.equal(isPublicSummaryEnvelope(ok(summary).envelope), true);
  assert.equal(isPublicSummaryEnvelope({ ...ok(summary).envelope, data: { ...summary, indexable: "yes" } }), false);
});

test("search bots by user agent; people are not bots", () => {
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)",
    "Mozilla/5.0 (compatible; Daum/4.1; +http://cs.daum.net/faq/15/4118.html)",
  ])
    assert.equal(isSearchBot(ua), true, ua);
  assert.equal(isSearchBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"), false);
  assert.equal(isSearchBot(null), false);
});
