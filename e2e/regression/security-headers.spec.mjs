// 보안 점검(v0.3.2 뒤, v0.3.5 강제): 응답에 X-Powered-By가 없고, 콘텐츠 보안 정책이 강제되며(요청마다 새 nonce,
// 인라인·eval 스크립트 허용 없음) 기기 권한 정책이 붙는다. 정책이 실제로 쓰는 출처를 다 담았는지는 주요 화면에서
// 위반이 0건인지로 보고, 정책 밖의 인라인 코드는 실제로 막히는지 본다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const scriptSrc = (csp) => csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src ")) ?? "";

test("응답 헤더: X-Powered-By 없음, 강제 CSP(요청마다 nonce), 기기 권한 끔 @regression", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response.headers();
  expect(headers["x-powered-by"]).toBeUndefined();
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("https://cdn-lostark.game.onstove.com");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  // Enforced, with no report-only copy beside it.
  expect(headers["content-security-policy-report-only"]).toBeUndefined();
  const scripts = scriptSrc(csp);
  expect(scripts).toMatch(/'nonce-[A-Za-z0-9+/=]{20,}'/);
  expect(scripts).toContain("'strict-dynamic'");
  expect(scripts).not.toContain("'unsafe-inline'");
  expect(scripts).not.toContain("'unsafe-eval'");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["permissions-policy"]).toContain("geolocation=()");

  // The page's inline scripts carry this response's nonce (read before the browser hides it).
  const nonce = scripts.match(/'nonce-([^']+)'/)[1];
  const html = await response.text();
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+)?json")([^>]*)>/g)];
  expect(inline.length).toBeGreaterThan(1);
  for (const [, attrs] of inline) expect(attrs, "인라인 스크립트의 nonce").toContain(`nonce="${nonce}"`);

  // A new request, a new nonce.
  const again = (await page.request.get("/")).headers()["content-security-policy"] ?? "";
  expect(scriptSrc(again).match(/'nonce-([^']+)'/)?.[1]).not.toBe(nonce);
});

test.describe("끼워 넣은 코드", () => {
  // The blocked handler is reported on the console by the browser: that report is the point here.
  test.use({ allowConsoleErrors: true });

  test("강제 CSP: 페이지에 끼워 넣은 인라인 코드는 실행되지 않는다 @regression", async ({ page }) => {
    await gotoReady(page, "/");
    const result = await page.evaluate(async () => {
      const violations = [];
      document.addEventListener("securitypolicyviolation", (e) => violations.push(e.violatedDirective));
      // An inline event handler, as an injected bit of markup would carry.
      const holder = document.createElement("div");
      holder.innerHTML = '<img src="data:," onerror="window.__ran = true" alt="">';
      document.body.append(holder);
      await new Promise((resolve) => setTimeout(resolve, 300));
      holder.remove();
      return { ran: window.__ran === true, violations };
    });
    expect(result.ran, "인라인 코드가 실행됨").toBe(false);
    expect(result.violations.some((directive) => directive.startsWith("script-src"))).toBe(true);
  });
});

const PAGES = [
  "/",
  "/stats",
  "/stats?tab=best",
  "/rankings",
  "/market",
  "/market/gems",
  "/market/accessories",
  "/news",
  "/schedule",
  "/tools/crit-speed",
  "/tools/refining",
  characterPath("상세"),
  characterPath("상세", "stats"),
  characterPath("상세", "skills"),
];

for (const path of PAGES)
  test(`CSP 위반 0건: ${path} @regression`, async ({ page }) => {
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

test("CSP 위반 0건: 나중에 불러오는 검색 창과 화면 사이 이동 @regression", async ({ page }) => {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await gotoReady(page, "/market");
  // The search panel's code arrives on the first press (a chunk loaded by a nonce'd script).
  await page.getByRole("button", { name: "캐릭터 검색" }).first().click();
  await expect(page.getByRole("combobox", { name: "캐릭터 이름" })).toBeFocused();
  await page.keyboard.press("Escape");
  // A client-side move keeps the same document and policy.
  await page.getByRole("link", { name: "보석", exact: true }).first().click();
  await expect(page).toHaveURL(/\/market\/gems/);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
});
