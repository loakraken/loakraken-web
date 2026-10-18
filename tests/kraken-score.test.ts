import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { krakenScoreView, type KrakenScore } from "../lib/character/kraken-score";
import { isCharacterEnvelope } from "../lib/character/validate";

const fixture = () =>
  JSON.parse(readFileSync(new URL("./fixtures/character-full-data.json", import.meta.url), "utf8"));
const envelope = (data: unknown) => ({ code: "CHARACTER_SEARCH_SUCCESS", message: "ok", data });

// The contract's own example (backend #561): 다이아 5,658.62, 38% in, 1,041.38 to 마스터.
const ok: KrakenScore = {
  status: "OK",
  reasonCode: null,
  reason: null,
  role: "DEALER",
  score: 5658.62,
  tier: { code: "DIAMOND", min: 5000, nextCode: "MASTER", nextMin: 6700, remaining: 1041.38, progressPercent: 38 },
  factors: [],
  ruleVersion: "kraken-score-v1",
};
const disabled: KrakenScore = { ...ok, status: "DISABLED", role: null, score: null, tier: null, ruleVersion: null };
const unsupported = (reasonCode: string): KrakenScore => ({ ...ok, status: "UNSUPPORTED", reasonCode, score: null, tier: null });

test("크라켄 점수: score, tier, way into the tier, whole points to the next", () => {
  assert.deepEqual(krakenScoreView(ok), {
    state: "ready",
    score: "5,658.62",
    tier: "다이아",
    tierCode: "DIAMOND",
    progress: 38,
    next: "마스터 티어까지 1,041점",
    bounds: "다이아 티어는 5,000점부터, 마스터 티어는 6,700점부터예요.",
  });
  // Whole points rounded, as comparison B (recorded samples g03, g06), x.50 up.
  const left = (remaining: number) => {
    const view = krakenScoreView({ ...ok, tier: { ...ok.tier!, remaining } });
    return view.state === "ready" ? view.next : null;
  };
  assert.equal(left(1143.15), "마스터 티어까지 1,143점");
  assert.equal(left(293.04), "마스터 티어까지 293점");
  assert.equal(left(1041.5), "마스터 티어까지 1,042점");
  assert.equal(left(0.4), "마스터 티어까지 0점");
});

test("크라켄 점수: the top tier is a full bar with no next line", () => {
  const top = krakenScoreView({
    ...ok,
    score: 10183.94,
    tier: { code: "ESTHER", min: 9500, nextCode: null, nextMin: null, remaining: null, progressPercent: 100 },
  });
  assert.equal(top.state, "ready");
  assert.equal(top.state === "ready" && top.tier, "에스더");
  assert.equal(top.state === "ready" && top.progress, 100);
  assert.equal(top.state === "ready" && top.next, null);
  assert.equal(top.state === "ready" && top.bounds, "에스더 티어는 9,500점부터로, 가장 높은 티어예요.");
});

test("크라켄 점수: not public or not sent is hidden; not computed or odd is '준비 중'", () => {
  assert.deepEqual(krakenScoreView(null), { state: "hidden" });
  assert.deepEqual(krakenScoreView(disabled), { state: "hidden" });
  // '준비 중' with why, per reason code (a later code reads as "can't show now").
  const why = (value: KrakenScore) => {
    const view = krakenScoreView(value);
    return view.state === "pending" ? view.reason.short : view.state;
  };
  assert.equal(why(unsupported("INPUT_PENDING")), "갱신하면 계산돼요");
  assert.equal(why(unsupported("ROLE_UNKNOWN")), "아크 패시브 정보가 없어요");
  assert.equal(why(unsupported("SCORE_UNAVAILABLE")), "무기·아크 패시브 정보가 부족해요");
  assert.equal(why(unsupported("CALC_FAILED")), "계산하지 못했어요");
  assert.equal(why(unsupported("A_CODE_FROM_LATER")), "지금은 보여 드릴 수 없어요");
  const failed = krakenScoreView(unsupported("CALC_FAILED"));
  assert.equal(failed.state === "pending" && failed.reason.long, "점수를 계산하지 못했어요. 잠시 뒤 갱신해 주세요.");
  for (const odd of [{ ...ok, score: -1 }, { ...ok, score: Number.NaN }, { ...ok, tier: null }])
    assert.equal(why(odd), "지금은 보여 드릴 수 없어요");
  // A status added later is not OK: '준비 중', not a number.
  assert.equal(why({ ...ok, status: "LATER" as KrakenScore["status"] }), "지금은 보여 드릴 수 없어요");
  // A tier added later still shows the score, its name as unknown.
  const later = krakenScoreView({ ...ok, tier: { ...ok.tier!, code: "LATER" as "DIAMOND" } });
  assert.equal(later.state === "ready" && later.tier, "알 수 없음");
});

test("크라켄 점수 in the character response: sent, not public, or missing (a backend before it)", () => {
  for (const score of [ok, disabled, unsupported("INPUT_PENDING")]) {
    const value = envelope({ ...fixture(), krakenScore: score });
    assert.equal(isCharacterEnvelope(value), true, score.status);
  }
  const before = envelope(fixture());
  delete (before.data as Record<string, unknown>).krakenScore;
  assert.equal(isCharacterEnvelope(before), true);
  assert.equal((before.data as { krakenScore: unknown }).krakenScore, null);
  // A tier added later does not reject the whole character.
  const later = envelope({ ...fixture(), krakenScore: { ...ok, tier: { ...ok.tier!, code: "LATER" } } });
  assert.equal(isCharacterEnvelope(later), true);
});
