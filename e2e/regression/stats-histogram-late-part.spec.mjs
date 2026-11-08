// 회귀(A6·A7): 첫 로드에서 페이지가 나뉘어 오면 통계 막대그래프의 막대가 일부만 먼저 그려질 수 있다. 막대가 남는 폭을
// 나눠 가지던 때는 먼저 온 막대가 넓게 그려졌다가 뒤의 막대가 올 때마다 좁아지며 움직였다(분포 탭 1280, 두 차트 api 404,
// CLS 0.07~0.10, 깨기 전). 이제 막대 수(--bins)가 목록에 먼저 있어 막대마다 자리가 처음부터 정해져 있다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/**
 * Plays a bar chart arriving in parts: every bar after the first is taken out, then put back one at a time in page
 * order, as a page split mid-way is drawn. Returns the layout shift this causes and what moved.
 */
const barsArriving = (list) =>
  list.evaluate(async (ol) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const [, ...later] = [...ol.children];
    for (const bar of later) bar.remove();
    await frame();
    const entries = [];
    const observer = new PerformanceObserver((records) => entries.push(...records.getEntries()));
    observer.observe({ type: "layout-shift" });
    for (const bar of later) {
      ol.append(bar);
      await frame();
    }
    entries.push(...observer.takeRecords());
    observer.disconnect();
    const name = (node) => {
      const el = node?.nodeType === 1 ? node : node?.parentElement;
      return el ? `${el.tagName.toLowerCase()}[${el.getAttribute("title") ?? ""}]` : "?";
    };
    return {
      value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(4),
      moved: [...new Set(entries.flatMap((entry) => entry.sources.map((source) => name(source.node))))].slice(0, 5).join(", "),
    };
  });

for (const width of [1280, 360]) {
  test(`@A7 ${width} 통계 분포(두 차트 api 404): 막대가 나뉘어 와도 먼저 그려진 막대는 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/\/api\/stats\/(gem-levels|level-combat-power)\?/, (route) =>
      route.fulfill({ status: 404, json: { ok: false, error: { code: "NOT_FOUND", status: 404 } } }),
    );
    await gotoReady(page, "/stats?tab=distribution");
    const bars = page.getByRole("tabpanel").getByRole("list", { name: /구간별 인원/ }).first();
    await expect(bars.getByRole("listitem").nth(2)).toBeAttached();
    const late = await barsArriving(bars);
    expect(late.value, `늦게 온 막대가 민 것 (${late.moved})`).toBe(0);
  });

  test(`@A7 ${width} 통계 보석 레벨 분포: 막대가 나뉘어 와도 먼저 그려진 막대는 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/stats?tab=distribution");
    const bars = page.getByRole("region", { name: "보석 레벨 분포" }).getByRole("list", { name: "보석 평균 레벨 구간별 인원" });
    await expect(bars.getByRole("listitem")).toHaveCount(12);
    const late = await barsArriving(bars);
    expect(late.value, `늦게 온 막대가 민 것 (${late.moved})`).toBe(0);
  });
}
