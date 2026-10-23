import assert from "node:assert/strict";
import test from "node:test";
import { siteVerification } from "../lib/site-verification";
import { PRODUCTION_URL } from "../lib/site";

test("ownership tags: both, one, none set", () => {
  assert.deepEqual(siteVerification({ GOOGLE_SITE_VERIFICATION: "g-code", NAVER_SITE_VERIFICATION: "n-code" }, PRODUCTION_URL), {
    google: "g-code",
    other: { "naver-site-verification": "n-code" },
  });
  assert.deepEqual(siteVerification({ GOOGLE_SITE_VERIFICATION: "g-code" }, PRODUCTION_URL), { google: "g-code" });
  assert.deepEqual(siteVerification({ NAVER_SITE_VERIFICATION: " n-code " }, PRODUCTION_URL), {
    other: { "naver-site-verification": "n-code" },
  });
  // Unset or blank: no tag at all.
  assert.equal(siteVerification({}, PRODUCTION_URL), undefined);
  assert.equal(siteVerification({ GOOGLE_SITE_VERIFICATION: "  ", NAVER_SITE_VERIFICATION: "" }, PRODUCTION_URL), undefined);
});

test("ownership tags: never off the production domain", () => {
  const env = { GOOGLE_SITE_VERIFICATION: "g-code", NAVER_SITE_VERIFICATION: "n-code" };
  assert.equal(siteVerification(env, "https://staging.example.org"), undefined);
  assert.equal(siteVerification(env, "http://127.0.0.1:3202"), undefined);
});
