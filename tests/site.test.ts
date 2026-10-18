import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTION_URL, SITEMAP_PATHS, isIndexable, siteUrl } from "../lib/site";

test("site URL comes from SITE_URL at run time and falls back to production", () => {
  assert.equal(siteUrl(undefined), PRODUCTION_URL);
  assert.equal(siteUrl(""), PRODUCTION_URL);
  assert.equal(siteUrl("http://127.0.0.1:8081"), "http://127.0.0.1:8081");
  assert.equal(siteUrl("https://loakraken.gg/"), PRODUCTION_URL);
  assert.equal(siteUrl("not a url"), PRODUCTION_URL);
  assert.equal(siteUrl("javascript:alert(1)"), PRODUCTION_URL);
});

test("only the production domain is indexable; sitemap lists fixed pages only", () => {
  assert.equal(isIndexable(PRODUCTION_URL), true);
  assert.equal(isIndexable("http://127.0.0.1:8081"), false);
  assert.equal(isIndexable("https://www.loakraken.gg"), false);
  assert.ok(SITEMAP_PATHS.every((path) => !path.startsWith("/character")));
});

test("the market detail pages are in the sitemap (A6)", () => {
  for (const path of ["/market/accessories", "/market/gems"])
    assert.ok((SITEMAP_PATHS as readonly string[]).includes(path), path);
});
