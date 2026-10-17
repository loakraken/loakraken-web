import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isPatchNotesEnvelope } from "../lib/home/validate";
import { newsPath, readNewsQuery } from "../lib/home/news";
import { requestPatchNotes } from "../lib/home/upstream";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./home-fixtures/${name}`, import.meta.url), "utf8"));
const params = (search: string) => new URLSearchParams(search);

test("backend-generated patch history fixture satisfies the contract", () => {
  const sample = fixture("home-patch-notes.json");
  assert.equal(isPatchNotesEnvelope(sample), true);
  // A kind added later shows as unknown instead of rejecting the response.
  sample.data.items[0].category = "HOTFIX";
  assert.equal(isPatchNotesEnvelope(sample), true);
  assert.equal(isPatchNotesEnvelope({ ...sample, code: "HOME_NEWS_SUCCESS" }), false);
});

test("news page state: tab and kind from the URL, unknown values fall back", () => {
  assert.deepEqual(readNewsQuery(params("")), { tab: "notice", noticeKind: null, patchKind: null });
  assert.deepEqual(readNewsQuery(params("kind=MAINTENANCE")), { tab: "notice", noticeKind: "MAINTENANCE", patchKind: null });
  assert.deepEqual(readNewsQuery(params("tab=patch&kind=BALANCE")), { tab: "patch", noticeKind: null, patchKind: "BALANCE" });
  // A patch kind on the notice tab (and the other way round) is ignored.
  assert.deepEqual(readNewsQuery(params("kind=BALANCE")), { tab: "notice", noticeKind: null, patchKind: null });
  assert.deepEqual(readNewsQuery(params("tab=patch&kind=SHOP")), { tab: "patch", noticeKind: null, patchKind: null });
  assert.deepEqual(readNewsQuery(params("tab=x&kind=toString")), { tab: "notice", noticeKind: null, patchKind: null });
  assert.equal(newsPath("notice", null), "/news");
  assert.equal(newsPath("notice", "EVENT"), "/news?kind=EVENT");
  assert.equal(newsPath("patch", "UPDATE"), "/news?tab=patch&kind=UPDATE");
  // LOAKraken 개발자 노트: its own tab, no kinds.
  assert.deepEqual(readNewsQuery(params("tab=dev")), { tab: "dev", noticeKind: null, patchKind: null });
  assert.deepEqual(readNewsQuery(params("tab=dev&kind=BALANCE")), { tab: "dev", noticeKind: null, patchKind: null });
  assert.equal(newsPath("dev", null), "/news?tab=dev");
});

test("patch history request: checks the query before calling the backend", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: URL | RequestInfo) => {
    calls.push(String(input));
    return Response.json(fixture("home-patch-notes.json"));
  }) as typeof fetch;
  const origin = "http://127.0.0.1:8080";
  const bad = await requestPatchNotes({ category: "SHOP", page: 1 }, origin, { fetcher });
  assert.equal(bad.ok, false);
  assert.equal((await requestPatchNotes({ category: null, page: 0 }, origin, { fetcher })).ok, false);
  assert.equal(calls.length, 0);
  const ok = await requestPatchNotes({ category: "UPDATE", page: 2 }, origin, { fetcher });
  assert.equal(ok.ok, true);
  assert.equal(calls[0], `${origin}/api/v1/home/patch-notes?category=UPDATE&page=2&size=20`);
});
