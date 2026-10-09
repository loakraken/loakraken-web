import assert from "node:assert/strict";
import test from "node:test";
import { backendUrl, forwardContext, requestBackend } from "../lib/api/backend";

const url = () => backendUrl("http://127.0.0.1:8080", "/api/v1/x");
const isAny = (body: unknown): body is unknown => body !== undefined;
const capture = () => {
  const seen: Headers[] = [];
  const fetcher = (async (_url: URL, init: RequestInit) => {
    seen.push(new Headers(init.headers));
    return Response.json({ code: "OK" });
  }) as unknown as typeof fetch;
  return { seen, fetcher };
};
const incoming = (headers: Record<string, string>) => forwardContext(new Headers(headers));
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

test("the client address is forwarded untouched when the request has one", async () => {
  const { seen, fetcher } = capture();
  const context = incoming({ "x-forwarded-for": "203.0.113.7, 10.0.0.2" });
  await requestBackend(url(), { isValid: isAny, errorCodes: {}, fetcher, context });
  assert.equal(seen[0].get("x-forwarded-for"), "203.0.113.7, 10.0.0.2");
});

test("no address outside a request (tests, scripts) or when the value is empty", async () => {
  const { seen, fetcher } = capture();
  await requestBackend(url(), { isValid: isAny, errorCodes: {}, fetcher });
  await requestBackend(url(), { isValid: isAny, errorCodes: {}, fetcher, context: incoming({ "x-forwarded-for": "" }) });
  assert.equal(seen[0].has("x-forwarded-for"), false);
  assert.equal(seen[1].has("x-forwarded-for"), false);
});

test("a request id is reused when valid, otherwise made fresh (O-8)", async () => {
  const { seen, fetcher } = capture();
  await requestBackend(url(), { isValid: isAny, errorCodes: {}, fetcher, context: incoming({ "x-request-id": "edge-1234abcd" }) });
  await requestBackend(url(), { isValid: isAny, errorCodes: {}, fetcher, context: incoming({ "x-request-id": "bad id <script>" }) });
  await requestBackend(url(), { isValid: isAny, errorCodes: {}, fetcher });
  assert.equal(seen[0].get("x-request-id"), "edge-1234abcd");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  assert.match(seen[1].get("x-request-id") ?? "", uuid);
  assert.match(seen[2].get("x-request-id") ?? "", uuid);
  assert.notEqual(seen[1].get("x-request-id"), seen[2].get("x-request-id"));
});

test("crawlers are flagged by User-Agent; an incoming bot header is never passed on", async () => {
  const { seen, fetcher } = capture();
  for (const agent of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)",
    "Mozilla/5.0 (compatible; Daumoa/4.0)",
    "facebookexternalhit/1.1",
  ])
    await requestBackend(url(), { isValid: isAny, errorCodes: {}, fetcher, context: incoming({ "user-agent": agent }) });
  assert.ok(seen.every((headers) => headers.get("x-loakraken-bot") === "1"));

  // A person's browser claiming the bot header gets no flag: only the web's own judgement counts.
  await requestBackend(url(), {
    isValid: isAny,
    errorCodes: {},
    fetcher,
    context: incoming({ "user-agent": CHROME, "x-loakraken-bot": "1" }),
  });
  assert.equal(seen.at(-1)?.has("x-loakraken-bot"), false);
});
