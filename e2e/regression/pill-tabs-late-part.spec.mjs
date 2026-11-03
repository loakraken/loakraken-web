// 회귀(A7): 첫 로드에서 페이지가 나뉘어 오면 알약 탭이 이름보다 먼저 그려질 수 있다. 이름이 오기 전의 좁은 탭은 누르는
// 자리(44px)가 가운데에 놓여 왼쪽으로 6px 나가 있다가, 이름이 오며 넓어진 탭에서는 제자리로 와 움직였다(랭킹 종류 탭 360,
// 둘째 탭). 이제 탭은 이름이 없어도 40px라 누르는 자리의 시작이 그대로다. 탭이 하나씩 올 때 앞의 탭도 움직이지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/**
 * Plays a pill tab row arriving in parts: every tab after the first is taken out, then each comes back empty
 * first and gets its label a frame later, in page order. Returns the layout shift this causes and what moved.
 */
const partsArriving = (list) =>
  list.evaluate(async (row) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const tabs = [...row.querySelectorAll(":scope > [role=tab]")].slice(1);
    const labels = tabs.map((tab) => [...tab.childNodes]);
    for (const tab of tabs) tab.remove();
    await frame();
    const entries = [];
    const observer = new PerformanceObserver((records) => entries.push(...records.getEntries()));
    observer.observe({ type: "layout-shift" });
    tabs.forEach((tab, i) => labels[i].forEach((node) => node.remove()));
    for (const [i, tab] of tabs.entries()) {
      row.append(tab);
      await frame();
      tab.append(...labels[i]);
      await frame();
    }
    entries.push(...observer.takeRecords());
    observer.disconnect();
    const name = (node) => {
      const el = node?.nodeType === 1 ? node : node?.parentElement;
      return el ? `${el.tagName.toLowerCase()}[${el.textContent.trim().slice(0, 8)}]` : "?";
    };
    return {
      value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(4),
      moved: [...new Set(entries.flatMap((entry) => entry.sources.map((source) => name(source.node))))].join(", "),
    };
  });

for (const [path, label] of [
  ["/rankings", "랭킹 종류"],
  ["/stats", null],
  ["/market", "시세 분류"],
])
  for (const width of [320, 360, 1280])
    test(`@A7 ${width} ${path}: 이름보다 먼저 그려진 알약 탭이 이름이 와도 움직이지 않는다 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await gotoReady(page, path);
      const list = label ? page.getByRole("tablist", { name: label }) : page.locator('[data-slot="pill-tabs"] [role=tablist]').first();
      await expect(list.getByRole("tab").nth(1)).toBeVisible();
      const late = await partsArriving(list);
      expect(late.value, `늦게 온 탭·이름이 민 것 (${late.moved})`).toBe(0);
    });
