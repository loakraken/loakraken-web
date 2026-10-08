import assert from "node:assert/strict";
import test from "node:test";
import { backendUrl, requestBackend } from "../lib/api/backend";

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

test("the client address is forwarded untouched when the request has one", async () => {
  const { seen, fetcher } = capture();
  await requestBackend(url(), { isValid: isAny, errorCodes: {}, fetcher, forwardedFor: "203.0.113.7, 10.0.0.2" });
  assert.equal(seen[0].get("x-forwarded-for"), "203.0.113.7, 10.0.0.2");
});

test("no header outside a request (tests, scripts) or when the value is empty", async () => {
  const { seen, fetcher } = capture();
  await requestBackend(url(), { isValid: isAny, errorCodes: {}, fetcher });
  await requestBackend(url(), { isValid: isAny, errorCodes: {}, fetcher, forwardedFor: null });
  assert.equal(seen[0].has("x-forwarded-for"), false);
  assert.equal(seen[1].has("x-forwarded-for"), false);
});
