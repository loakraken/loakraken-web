import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isPopularEnvelope, requestPopular } from "../lib/character/popular";

const fixture = () =>
  JSON.parse(readFileSync(new URL("./popular-fixtures/characters-popular.json", import.meta.url), "utf8"));
const origin = "http://127.0.0.1:8080";

test("backend popular sample satisfies the contract; counts are not part of it", () => {
  const body = fixture();
  assert.equal(isPopularEnvelope(body), true);
  assert.ok(body.data.items.every((item: object) => !("views" in item) && !("count" in item)));
  const broken = fixture();
  broken.data.sampleStatus = "MAYBE";
  assert.equal(isPopularEnvelope(broken), false);
});

test("popular requests allow-list the period and limit", async () => {
  let calls = 0;
  const fetcher = (async (url: URL) => {
    calls++;
    assert.equal(url.searchParams.get("period"), "7d");
    return Response.json(fixture());
  }) as unknown as typeof fetch;
  assert.equal((await requestPopular("7d", 10, origin, { fetcher })).ok, true);
  assert.equal((await requestPopular("30d", 10, origin, { fetcher })).ok, false);
  assert.equal((await requestPopular("24h", 99, origin, { fetcher })).ok, false);
  assert.equal(calls, 1);
});
