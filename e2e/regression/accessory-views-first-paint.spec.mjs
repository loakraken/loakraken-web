// 회귀(A7, #1525 CI 360 flaky): 장신구 '시세 · 매물 검색' 전환은 첫 HTML이 나뉘어 와 링크 글자가 늦게 그려져도
// 움직이지 않는다. 휴대폰의 누름 영역(hit-44, 보이지 않는 ::after)은 링크 가운데에 놓이는데, 글자 없는 링크는
// 40px보다 좁아 44px 영역이 가운데 기준으로 왼쪽에 있다가 글자가 오면 링크 폭+4로 바뀌며 시작점이 6px 움직였다
// (CI: a.view::after 80,239 44x44 → 86,239 82x44, 깨기 186ms 전). 링크가 처음부터 40px 이상이면 시작점이 같다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** Each view link painted without its label first, then the label arriving: the layout shift and what moved. */
const labelsArriving = (page) =>
  page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const links = [...document.querySelectorAll('nav[aria-label="장신구 보기"] a')];
    const entries = [];
    for (const link of links) {
      // Cut as the first HTML does, right after this link's start tag: its label and everything after it in the
      // document (each ancestor's later siblings) are not here yet. They come back in page order.
      const label = [...link.childNodes];
      const after = [];
      for (let node = link; node && node !== document.body; node = node.parentElement) {
        const siblings = [];
        for (let next = node.nextSibling; next; next = next.nextSibling) siblings.push(next);
        after.push([node.parentElement, siblings]);
      }
      for (const node of label) node.remove();
      for (const [, siblings] of after) for (const node of siblings) node.remove();
      await frame();
      const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
      observer.observe({ type: "layout-shift" });
      link.append(...label);
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
      `${source.node?.nodeType === 1 ? `${source.node.tagName.toLowerCase()} '${source.node.textContent.trim()}'` : source.node ? source.node.nodeName : "::after"} ${box(source.previousRect)}→${box(source.currentRect)}`;
    return {
      links: links.length,
      value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(7),
      moved: [...new Set(entries.flatMap((entry) => entry.sources.map((source) => name(source))))].join(", "),
    };
  });

for (const path of ["/market/accessories", "/market/accessories/search"])
  for (const width of [320, 360, 390])
    test(`@A7 ${width} 장신구 보기 전환: 링크 글자가 늦게 와도 누름 영역이 움직이지 않는다 (${path}) @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, path);
      const nav = page.getByRole("navigation", { name: "장신구 보기" });
      await expect(nav.getByRole("link")).toHaveCount(2);
      const late = await labelsArriving(page);
      expect(late.links).toBe(2);
      expect(late.value, `늦게 온 글자가 민 것 (${late.moved})`).toBe(0);
    });
