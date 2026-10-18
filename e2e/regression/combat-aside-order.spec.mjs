// 회귀(v0.3.2 친구 시험 피드백 ②): 캐릭터 전투 탭 오른쪽 열(요약)은 특성 → 각인 → 아크 패시브 → 순위 →
// 조회수 순서(공식과 같은 특성 → 각인 먼저, 순위는 머리 배너에도 있어 아래로). 360은 한 열에서 같은 순서.
// 순위 블록이 늦게 채워져도 아무것도 움직이지 않는다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const ORDER = ["특성", "각인", "아크 패시브", "순위", "조회수"];

for (const width of [1280, 360])
  test(`@전투탭순서 ${width}: 요약 열 제목 순서, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shifts.push(e.value);
      }).observe({ type: "layout-shift", buffered: true });
    });
    await gotoReady(page, characterPath("상세"));
    const aside = page.getByRole("complementary", { name: "요약", exact: true });
    await expect(aside.locator(":scope > * h2")).toHaveText(ORDER);
    // The rank block has filled in (or said why not) under the others.
    await expect(aside.locator(":scope > *").nth(3)).not.toContainText("불러오는 중");
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.__shifts.reduce((a, v) => a + v, 0)), "첫 로드 흔들림").toBe(0);
  });
