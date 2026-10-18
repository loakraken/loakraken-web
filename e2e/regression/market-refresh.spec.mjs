// 회귀(사용자 지시 10-16: 시세가 들어가는 화면은 1분 자동 갱신): 보석·장신구 시세판과 스펙업 기대 비용은
// 열어 둔 동안 1분마다 시세를 다시 받는다(공식 호출이 아니라 서버 캐시 값). 다시 받아도 화면은 흔들리지 않는다.
import { test, expect, gotoReady, characterPath } from "../support/fixtures.mjs";

const cases = [
  { name: "보석 시세판", path: "/market/gems", api: /\/api\/markets\/auctions\/gems$/, ready: (page) => page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" }) },
  { name: "장신구 시세판", path: "/market/accessories", api: /\/api\/markets\/auctions\/accessories(\?.*)?$/, ready: (page) => page.getByRole("region", { name: /^목걸이/ }) },
  { name: "스펙업 기대 비용", path: characterPath("전투력계산", "specup"), api: /\/api\/characters\/spec-up\?/, ready: (page) => page.getByRole("table", { name: /스펙업 후보/ }) },
];

for (const c of cases)
  test(`${c.name}: 1분마다 다시 받고 흔들림 0 @regression`, async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(() => {
      window.__shifts = [];
      window.__from = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          // With what moved, for the failure message (two decimals: a sub-pixel
          // move rounds to no move).
          window.__shifts.push({
            v: e.value,
            src: (e.sources ?? []).map((s) => {
              const el = s.node?.nodeType === 1 ? s.node : s.node?.parentElement;
              const r = (b) => [b.x, b.y, b.width, b.height].map((n) => n.toFixed(2)).join(",");
              const cls = typeof el?.className === "string" ? el.className.split(" ")[0] : "";
              const text = (el?.textContent ?? "").trim().slice(0, 20);
              return `+${Math.round(e.startTime - window.__from)}ms ${e.value.toFixed(5)} ${el?.tagName}${cls ? `.${cls}` : ""} "${text}" ${r(s.previousRect)}→${r(s.currentRect)}`;
            }),
          });
      }).observe({ type: "layout-shift", buffered: true });
    });
    const asked = [];
    page.on("request", (r) => c.api.test(new URL(r.url()).pathname + new URL(r.url()).search) && asked.push(Date.now()));
    await gotoReady(page, c.path);
    await expect(c.ready(page)).toBeVisible();
    // Past the blank-cell fill looks (5 s, six at most): step the clock and let
    // each answer land (real time) until no new request comes, so only the
    // minute refresh is left to see.
    let settled = 0;
    for (let i = 0, last = -1; i < 20 && settled < 3; i++) {
      await page.clock.runFor(6_000);
      await page.waitForTimeout(250);
      settled = asked.length === last ? settled + 1 : 0;
      last = asked.length;
    }
    expect(settled, "채우기 요청이 멈춤").toBe(3);
    const first = asked.length;
    await page.evaluate(() => {
      window.__shifts = [];
      window.__from = document.timeline.currentTime;
    });
    await page.clock.runFor(61_000);
    await expect.poll(() => asked.length, { message: "1분 뒤 다시 받음" }).toBeGreaterThan(first);
    await expect(c.ready(page)).toBeVisible();
    await page.clock.runFor(2_000);
    const after = await page.evaluate(() => window.__shifts);
    expect(
      after.reduce((a, e) => a + e.v, 0),
      `다시 받은 뒤 layout-shift: ${[...new Set(after.flatMap((e) => e.src))].slice(0, 8).join(" | ")}`,
    ).toBe(0);
  });
