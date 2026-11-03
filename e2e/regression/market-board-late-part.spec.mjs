// 회귀(#1353, A7): 시세 화면 첫 로드에서 페이지가 둘로 나뉘어 오면(앞부분이 먼저 그려짐) 나중에 온 부분이 이미 그려진
// 시세 표를 밀어내지 않는다. 휴대폰에서는 품목 상세가 표 위에 보이는데 페이지에서는 표 뒤에 있어, 늦게 온 상세가 위에 끼어들며
// 표를 화면 밖으로 밀었다(CI 320, 0.5457, 깨기 전). 이제 페이지 순서가 보이는 순서와 같다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

/**
 * Plays the board area arriving in parts: everything after its first part is taken out, then put back one part at
 * a time in page order, as a page split mid-way is drawn. Returns the layout shift this causes and what moved.
 */
const partsArriving = (page) =>
  page.evaluate(async () => {
    const columns = document.querySelector('section[aria-labelledby="board-heading"]').parentElement;
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const [, ...later] = [...columns.children];
    for (const part of later) part.remove();
    await frame();
    const entries = [];
    const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
    observer.observe({ type: "layout-shift" });
    for (const part of later) {
      columns.append(part);
      await frame();
    }
    await frame();
    entries.push(...observer.takeRecords());
    observer.disconnect();
    const name = (node) => (node?.nodeType === 1 ? `${node.tagName.toLowerCase()}.${String(node.className).split(" ")[0]}` : "?");
    return {
      value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(4),
      moved: [...new Set(entries.flatMap((entry) => entry.sources.map((source) => name(source.node))))].join(", "),
    };
  });

for (const width of [320, 1280])
  test(`@A7 ${width} 시세: 나중에 온 부분이 먼저 그려진 표·상세를 밀지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await watchShifts(page);
    await gotoReady(page, "/market");
    await expect(page.locator("#board-heading")).toBeVisible();
    // The cold load itself (this run arrived whole, so this mostly guards the rest of the page).
    const load = await shiftsSince(page);
    expect(load.all, `첫 로드 흔들림 (${load.moved})`).toBe(0);
    const late = await partsArriving(page);
    expect(late.value, `늦게 온 부분이 민 것 (${late.moved})`).toBe(0);
  });
