// 성능 점검(비필수): 작업 규칙 "성능 우선" 기준을 홈·캐릭터·시세에서 잰다.
// - 모바일 기준: 390×844, CPU 4배 감속(CDP Emulation.setCPUThrottlingRate)
// - LCP ≤ 2.5초, CLS ≤ 0.1, INP(클릭 1회 응답, Event Timing 근사) ≤ 200ms, 긴 작업(50ms 초과) 수 기록
// - 기본 실행에서는 빠진다(E2E_PERF=1일 때만). 기준 초과는 E2E_PERF_ENFORCE=1일 때만 실패로 본다.
// - dev 서버 수치는 컴파일·개발 도구 때문에 부풀려진다. 운영 빌드로 잰다:
//   E2E_PERF=1 E2E_SERVER=standalone npx playwright test --project=perf
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const BUDGET = { lcp: 2500, cls: 0.1, inp: 200 };
const enforce = process.env.E2E_PERF_ENFORCE === "1";

// 측정용 관찰자는 페이지 스크립트보다 먼저 붙인다.
const OBSERVE = () => {
  const m = (window.__perf = { lcp: 0, cls: 0, longTasks: 0, longTaskMs: 0, inp: 0 });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (m.lcp = Math.max(m.lcp, e.startTime)))).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) m.cls += e.value; })).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { m.longTasks += 1; m.longTaskMs += e.duration; })).observe({ type: "longtask", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.interactionId) m.inp = Math.max(m.inp, e.duration); })).observe({ type: "event", buffered: true, durationThreshold: 16 });
};

const PAGES = [
  { name: "홈", path: "/", interact: (page) => page.getByRole("group", { name: "요일 선택" }).locator('button[aria-pressed="false"]').first().click() },
  { name: "캐릭터", path: characterPath("상세"), interact: (page) => page.getByRole("navigation", { name: "캐릭터 정보 탭" }).getByRole("link", { name: "스킬", exact: true }).click() },
  { name: "시세", path: "/market", interact: (page) => page.getByRole("navigation", { name: "시세 분류" }).getByRole("button", { name: "각인서" }).click() },
];

test.describe("성능 기준 @perf", () => {
  // 측정끼리 CPU를 다투지 않게 한 번에 하나씩 잰다.
  test.describe.configure({ mode: "serial" });
  for (const target of PAGES) {
    test(`${target.name}: CPU 4배 감속 LCP·CLS·INP`, async ({ page }, testInfo) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.addInitScript(OBSERVE);
      await gotoReady(page, target.path);
      // 로딩 중 CLS(사용자 조작 없이 생긴 이동)를 먼저 떼어 둔다.
      const loadCls = await page.evaluate(() => window.__perf.cls);
      await target.interact(page);
      await page.waitForTimeout(1000); // 클릭 뒤 그리기와 늦은 레이아웃 이동까지
      const m = await page.evaluate(() => window.__perf);
      const result = {
        page: target.name,
        lcpMs: Math.round(m.lcp),
        cls: Math.round(m.cls * 1000) / 1000,
        loadCls: Math.round(loadCls * 1000) / 1000,
        inpMs: Math.round(m.inp),
        longTasks: m.longTasks,
        longTaskMs: Math.round(m.longTaskMs),
        server: process.env.E2E_SERVER ?? "dev",
      };
      await testInfo.attach("perf", { body: JSON.stringify(result), contentType: "application/json" });
      console.log(`[perf] ${JSON.stringify(result)}`);
      const check = enforce ? expect : expect.soft;
      if (enforce || process.env.E2E_PERF_SOFT === "1") {
        check(result.lcpMs, `${target.name} LCP`).toBeLessThanOrEqual(BUDGET.lcp);
        check(result.cls, `${target.name} CLS`).toBeLessThanOrEqual(BUDGET.cls);
        check(result.inpMs, `${target.name} INP`).toBeLessThanOrEqual(BUDGET.inp);
      }
    });
  }
});
