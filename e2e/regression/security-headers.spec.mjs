// 보안 점검(v0.3.2 뒤): 응답에 X-Powered-By가 없고, 콘텐츠 보안 정책(우선 보고만)과 기기 권한 정책이
// 붙는다. 정책이 실제로 쓰는 출처를 다 담았는지는 주요 화면에서 위반 보고가 0건인지로 본다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("응답 헤더: X-Powered-By 없음, 보고만 하는 CSP, 기기 권한 끔 @regression", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response.headers();
  expect(headers["x-powered-by"]).toBeUndefined();
  const csp = headers["content-security-policy-report-only"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("https://cdn-lostark.game.onstove.com");
  expect(csp).toContain("frame-ancestors 'none'");
  // Report-only until a later release: nothing is enforced yet.
  expect(headers["content-security-policy"]).toBeUndefined();
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["permissions-policy"]).toContain("geolocation=()");
});

const PAGES = ["/", "/stats", "/stats?tab=best", "/rankings", "/market", "/news", "/tools/crit-speed", characterPath("상세")];

for (const path of PAGES)
  test(`CSP 위반 보고 0건: ${path} @regression`, async ({ page }) => {
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await gotoReady(page, path);
    // Images below the fold and late panels load too.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__csp)).toEqual([]);
  });
