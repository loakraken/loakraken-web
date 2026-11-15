// 회귀(A7, #1534 CI 360 flaky: material-quote-box-categories): 허브 탭 줄(품목 시세·재료 견적…)은
// 첫 HTML이 나뉘어 와 탭 글자가 늦게 그려져도 누름 영역이 움직이지 않는다. 휴대폰의 누름 영역(hit-44,
// 보이지 않는 ::after)은 탭 가운데에 놓이는데, 글자 없는 탭은 안쪽 여백(30x16)뿐이라 44px 영역이 왼쪽 7px·위
// 14px에서 시작하다가 글자가 오면 왼쪽 2px·위 4px로 옮겨 갔다(시작점 5px 이동). 탭이 처음부터 40px 이상·한 줄
// 높이면 시작점이 같다(#1527 장신구 보기와 같은 고침).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** Each hub tab painted without its label first, then the label arriving: the layout shift and what moved. */
const labelsArriving = (page) =>
  page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const tabs = [...document.querySelectorAll('nav[aria-label$="화면"] a')];
    const entries = [];
    for (const tab of tabs) {
      // Cut as the first HTML does, right after this tab's start tag: its label and everything after it in the
      // document (each ancestor's later siblings) are not here yet. They come back in page order.
      const label = [...tab.childNodes];
      const after = [];
      for (let node = tab; node && node !== document.body; node = node.parentElement) {
        const siblings = [];
        for (let next = node.nextSibling; next; next = next.nextSibling) siblings.push(next);
        after.push([node.parentElement, siblings]);
      }
      for (const node of label) node.remove();
      for (const [, siblings] of after) for (const node of siblings) node.remove();
      await frame();
      const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
      observer.observe({ type: "layout-shift" });
      tab.append(...label);
      await frame();
      for (const [parent, siblings] of after) parent.append(...siblings);
      await frame();
      await frame();
      entries.push(...observer.takeRecords());
      observer.disconnect();
    }
    // A pseudo-element (the tap area) comes without a node: its boxes say what moved.
    const box = (r) => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    const name = (source) =>
      `${source.node?.nodeType === 1 ? `${source.node.tagName.toLowerCase()} '${source.node.textContent.trim().slice(0, 12)}'` : source.node ? source.node.nodeName : "::after"} ${box(source.previousRect)}→${box(source.currentRect)}`;
    return {
      tabs: tabs.length,
      value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(7),
      moved: [...new Set(entries.flatMap((entry) => entry.sources.map((source) => name(source))))].join(", "),
    };
  });

for (const path of ["/market/quote", "/market"])
  for (const width of [320, 360, 390])
    test(`@A7 ${width} 허브 탭: 탭 글자가 늦게 와도 누름 영역이 움직이지 않는다 (${path}) @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      // The second load has the site font from the cache (display: optional), as most visits do: the measure
      // is then about the tabs, not about a first visit that kept the system face.
      await gotoReady(page, path);
      await gotoReady(page, path);
      const nav = page.getByRole("navigation", { name: /화면$/ });
      await expect(nav.getByRole("link").first()).toBeVisible();
      const late = await labelsArriving(page);
      // 시세 has 품목 시세 · 재료 견적 (and 시세 알림 when its flag is on) since 보석 · 장신구 joined the
      // category row (#1597, user 11-12).
      expect(late.tabs).toBeGreaterThanOrEqual(2);
      expect(late.value, `늦게 온 글자가 민 것 (${late.moved})`).toBe(0);
    });
