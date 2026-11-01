import assert from "node:assert/strict";
import test from "node:test";
import { alertErrorText, conditionText, isAlertId, isManageToken, parseConditionBody, parseSubscribeBody } from "../lib/alerts/model";
import { isDoneEnvelope, requestAddCondition, requestUnsubscribe } from "../lib/alerts/model.backend";
import { isPriceAlertsEnabled } from "../lib/tools/flags";

const ID = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const TOKEN = "q9Vd2kX4mN7pR1sT5uW8yZ0aB3cE6fH9jL2nP5rS8tU";

test("price alerts flag: on only when PRICE_ALERTS=on, on every deployment", () => {
  assert.equal(isPriceAlertsEnabled({}), false);
  assert.equal(isPriceAlertsEnabled({ PRICE_ALERTS: "off" }), false);
  assert.equal(isPriceAlertsEnabled({ PRICE_ALERTS: " ON " }), true);
  assert.equal(isPriceAlertsEnabled({ PRICE_ALERTS: "on", SITE_URL: "http://localhost:3000" }), true);
});

test("alert ids and tokens: a UUID and a base64url token, nothing else reaches the backend", () => {
  assert.equal(isAlertId(ID), true);
  assert.equal(isAlertId("../alerts"), false);
  assert.equal(isAlertId(`${ID}/conditions`), false);
  assert.equal(isManageToken(TOKEN), true);
  assert.equal(isManageToken(null), false);
  assert.equal(isManageToken("short"), false);
  assert.equal(isManageToken(`${TOKEN}\n`), false);
  assert.equal(isManageToken("a".repeat(129)), false);
});

test("subscribe body: the browser's https endpoint and both keys, within the backend's sizes", () => {
  const body = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BPk", auth: "xyz" }, expirationTime: null };
  assert.deepEqual(parseSubscribeBody(body), { endpoint: body.endpoint, keys: body.keys });
  assert.equal(parseSubscribeBody({ ...body, endpoint: "http://fcm.googleapis.com/x" }), null);
  assert.equal(parseSubscribeBody({ ...body, keys: { p256dh: "BPk" } }), null);
  assert.equal(parseSubscribeBody({ ...body, endpoint: `https://${"a".repeat(1100)}` }), null);
  assert.equal(parseSubscribeBody(null), null);
});

test("condition body: item id, one of two lines, 0.01 ~ 999,999,999,999.99 gold with two decimals", () => {
  assert.deepEqual(parseConditionBody({ itemId: 6861012, comparator: "AT_OR_BELOW", price: 95.5 }), {
    itemId: 6861012,
    comparator: "AT_OR_BELOW",
    price: 95.5,
  });
  assert.equal(parseConditionBody({ itemId: 6861012, comparator: "BELOW", price: 95 }), null);
  assert.equal(parseConditionBody({ itemId: 0, comparator: "AT_OR_ABOVE", price: 95 }), null);
  assert.equal(parseConditionBody({ itemId: 1, comparator: "AT_OR_ABOVE", price: 0 }), null);
  assert.equal(parseConditionBody({ itemId: 1, comparator: "AT_OR_ABOVE", price: 1.234 }), null);
  assert.equal(parseConditionBody({ itemId: 1, comparator: "AT_OR_ABOVE", price: 1e13 }), null);
  assert.equal(parseConditionBody({ itemId: "1", comparator: "AT_OR_ABOVE", price: 1 }), null);
});

test("condition text and failures in Korean, none of the backend's own text", () => {
  assert.equal(conditionText("AT_OR_BELOW", 1234.5), "1,234.5G 이하");
  assert.equal(conditionText("AT_OR_ABOVE", 90), "90G 이상");
  assert.match(alertErrorText("ALERT_TOO_MANY_CONDITIONS"), /10개까지/);
  assert.match(alertErrorText("ALERT_PUSH_NOT_DELIVERED"), /알림 권한/);
  assert.match(alertErrorText(undefined), /처리하지 못했어요/);
});

test("unsubscribe and delete answer with no data", () => {
  assert.equal(isDoneEnvelope({ code: "ALERT_SUCCESS", message: "", data: null }), true);
  assert.equal(isDoneEnvelope({ code: "ALERT_SUCCESS", message: "" }), true);
  assert.equal(isDoneEnvelope({ code: "ALERT_SUCCESS", message: "", data: {} }), false);
  assert.equal(isDoneEnvelope({ code: "STATS_CLASSES_SUCCESS", data: null }), false);
});

test("alert requests: the token goes in X-Alert-Token, never in the address", async () => {
  const asked: { url: string; method: string; headers: Headers; body: string | null }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    asked.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: (init?.body as string | undefined) ?? null,
    });
    return new Response(JSON.stringify({ code: "ALERT_SUCCESS", message: "", data: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const context = { forwardedFor: null, requestId: "test-request-1", bot: false };
  const off = await requestUnsubscribe(ID, TOKEN, "http://backend.test", { fetcher, context });
  assert.equal(off.ok, true);
  assert.equal(asked[0].method, "DELETE");
  assert.equal(new URL(asked[0].url).pathname, `/api/v1/alerts/subscriptions/${ID}`);
  assert.equal(asked[0].headers.get("x-alert-token"), TOKEN);
  assert.equal(asked[0].url.includes(TOKEN), false);

  await requestAddCondition(ID, TOKEN, { itemId: 6861012, comparator: "AT_OR_ABOVE", price: 100 }, "http://backend.test", {
    fetcher,
    context,
  });
  assert.equal(asked[1].method, "POST");
  assert.equal(new URL(asked[1].url).pathname, `/api/v1/alerts/subscriptions/${ID}/conditions`);
  assert.deepEqual(JSON.parse(asked[1].body ?? "null"), { itemId: 6861012, comparator: "AT_OR_ABOVE", price: 100 });
  assert.equal(asked[1].headers.get("x-alert-token"), TOKEN);
});
