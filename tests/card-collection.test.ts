import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  appliedStage,
  isCardCollectionEnvelope,
  isCardRefreshEnvelope,
  refreshSummary,
  slotsFor,
  sortCards,
} from "../lib/character/card-collection";
import { requestCardCollection, requestCardRefresh } from "../lib/character/related";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`./card-fixtures/card-collection-${name}.json`, import.meta.url), "utf8"),
  );
const origin = "http://127.0.0.1:8080";

test("backend samples (dealer, supporter, empty) satisfy the generated contract", () => {
  for (const name of ["dealer", "supporter", "empty"])
    assert.equal(isCardCollectionEnvelope(fixture(name)), true, name);
  const badEffect = fixture("dealer");
  badEffect.data.sets[0].effects[0].active = "yes";
  assert.equal(isCardCollectionEnvelope(badEffect), false);
});

test("slots follow the role and 도감 sorts by grade, awakening, name", () => {
  const dealer = fixture("dealer").data;
  assert.equal(slotsFor(dealer)[0].setName, "세상을 구하는 빛");
  const supporter = fixture("supporter").data;
  assert.equal(slotsFor(supporter)[0].setName, "남겨진 바람의 절벽");
  const sorted = sortCards(dealer.cards);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (a.grade === b.grade) assert.ok(a.awakeCount >= b.awakeCount);
  }
});

test("card collection requests validate the name and pass through allow-listed errors", async () => {
  let calls = 0;
  const fetcher = (async (url: URL) => {
    calls++;
    assert.equal(url.pathname, "/api/v1/characters/card-collection");
    return Response.json(fixture("dealer"));
  }) as unknown as typeof fetch;
  assert.equal((await requestCardCollection("목캐릭터A", origin, { fetcher })).ok, true);
  assert.equal((await requestCardCollection("", origin, { fetcher })).ok, false);
  assert.equal(calls, 1);
  const disabled = await requestCardCollection("목캐릭터A", origin, {
    fetcher: (async () =>
      Response.json({ code: "CARD_COLLECTION_DISABLED" }, { status: 503 })) as typeof fetch,
  });
  assert.deepEqual(disabled.ok ? null : disabled.error, { code: "CARD_COLLECTION_DISABLED", status: 503 });
});

test("the awakening total leads; the applied stage shows only when lower", () => {
  assert.equal(appliedStage({ awakening: 28, activeAwakening: 24 }), 24);
  assert.equal(appliedStage({ awakening: 30, activeAwakening: 30 }), null);
  assert.equal(appliedStage({ awakening: 12, activeAwakening: null }), null);
});

test("refill: summary in words, POST, cooldown 429 keeps its code, other 429 is the rate limit", async () => {
  const sample = fixture("refresh");
  assert.equal(isCardRefreshEnvelope(sample), true);
  assert.equal(
    refreshSummary(sample.data),
    "원정대 14명 중 11명을 새로 기록했어요. 1명은 최근 7일 안에 기록이 있어 그대로 두었어요. 1명은 불러오지 못했어요. 1명은 다음에 이어서 채울 수 있어요.",
  );
  assert.doesNotMatch(refreshSummary(sample.data), /skipped|failed|remaining/);
  const calls: RequestInit[] = [];
  const reply = (status: number, body: object, headers: Record<string, string> = {}) =>
    (async (_url: URL, init: RequestInit) => {
      calls.push(init);
      return Response.json(body, { status, headers });
    }) as unknown as typeof fetch;
  assert.equal((await requestCardRefresh("가1", origin, { fetcher: reply(200, sample) })).ok, true);
  assert.equal(calls[0].method, "POST");
  const cooldown = await requestCardRefresh("가1", origin, {
    fetcher: reply(429, { code: "CARD_COLLECTION_REFRESH_COOLDOWN" }, { "Retry-After": "420" }),
  });
  assert.equal(cooldown.ok, false);
  if (!cooldown.ok) assert.equal(cooldown.error.code, "CARD_COLLECTION_REFRESH_COOLDOWN");
  const client = await requestCardRefresh("가1", origin, { fetcher: reply(429, { code: "CLIENT_RATE_LIMITED" }) });
  if (!client.ok) assert.equal(client.error.code, "LOST_ARK_RATE_LIMITED");
});
