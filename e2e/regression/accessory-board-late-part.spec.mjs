// 회귀(A7): 장신구 시세 첫 로드에서 페이지가 나뉘어 와 한 칸의 최저가까지만 먼저 그려져도(전일 대비·매물 줄은 나중에),
// 나중에 온 줄이 이미 그려진 최저가를 움직이지 않는다. 칸은 최소 높이 78px의 세 줄 격자인데 줄이 남는 높이를 나눠 가져,
// 줄이 둘뿐일 때 최저가 줄이 더 길었다가 셋째 줄이 오면 줄어들며 최저가가 5.6px 올라갔다(CI 360, 0.0000674, 깨기 전).
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

/**
 * Plays every ready cell arriving cut off: each cut leaves the cell's first parts (the label, then the label and
 * the price), then puts the rest back as the page's next part is drawn. Returns the layout shift and what moved.
 */
const cellsArriving = (page) =>
  page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const name = (node) => (node?.nodeType === 1 ? `${node.tagName.toLowerCase()}.${String(node.className).split(" ")[0]} '${node.textContent.trim()}'` : "?");
    const buttons = [...document.querySelectorAll("main section[aria-labelledby^='slot-'] li button")];
    const entries = [];
    for (const keep of [1, 2]) {
      const later = buttons.map((button) => [button, [...button.children].slice(keep)]);
      for (const [, parts] of later) for (const part of parts) part.remove();
      await frame();
      const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
      observer.observe({ type: "layout-shift" });
      for (const [button, parts] of later) button.append(...parts);
      await frame();
      await frame();
      entries.push(...observer.takeRecords());
      observer.disconnect();
    }
    return {
      cells: buttons.length,
      value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(7),
      moved: [...new Set(entries.flatMap((entry) => entry.sources.map((source) => name(source.node))))].join(", "),
    };
  });

for (const width of [360, 1280])
  test(`@A7 ${width} 장신구 시세: 칸의 나중에 온 줄이 먼저 그려진 최저가를 밀지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market/accessories");
    await expect(page.getByRole("region", { name: /^목걸이/ }).getByRole("button")).toHaveCount(6);
    const load = await shiftsSince(page);
    expect(load.all, `첫 로드 흔들림 (${load.moved})`).toBe(0);
    const late = await cellsArriving(page);
    expect(late.cells, "다시 그린 칸").toBeGreaterThan(10);
    expect(late.value, `늦게 온 줄이 민 것 (${late.moved})`).toBe(0);
  });
