// 회귀(#1333, A6·A7): 첫 로드에서 페이지가 나뉘어 오면(앞부분이 먼저 그려짐) 머리글의 나중에 온 단추가 이미 그려진 단추를
// 밀지 않는다. 메뉴 단추는 900px 이하에서 맨 오른쪽에 보이지만 페이지에서는 검색·테마보다 앞이라, 그것만 먼저 그려지면 로고
// 바로 옆에 있다가 뒤의 단추가 오며 오른쪽 끝으로 밀렸고(360, 메뉴 단추 144→302), 넓은 화면에서는 맨 끝의 테마 단추가 늦게
// 오며 검색·디스코드를 왼쪽으로 밀었다(1280). 이제 단추마다 머리글 안의 자리가 정해져 있다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

/**
 * Plays the header arriving in parts: everything after the logo is taken out, then put back one part at a time in
 * page order, as a page split mid-way is drawn. Returns the layout shift this causes and what moved.
 */
const partsArriving = (page) =>
  page.evaluate(async () => {
    const header = document.querySelector("header[data-sticky-chrome]");
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const [, ...later] = [...header.children];
    for (const part of later) part.remove();
    await frame();
    const entries = [];
    const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
    observer.observe({ type: "layout-shift" });
    for (const part of later) {
      header.append(part);
      await frame();
    }
    await frame();
    entries.push(...observer.takeRecords());
    observer.disconnect();
    const name = (node) => {
      const el = node?.nodeType === 1 ? node : node?.parentElement;
      return el ? `${el.tagName.toLowerCase()}.${String(el.className).split(" ").find((c) => c.includes("_")) ?? ""}` : "?";
    };
    return {
      value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(4),
      moved: [...new Set(entries.flatMap((entry) => entry.sources.map((source) => name(source.node))))].join(", "),
    };
  });

for (const [label, path] of [
  ["랭킹", "/rankings"],
  ["시세", "/market"],
  ["캐릭터", characterPath("상세")],
])
  for (const width of [320, 360, 768, 1280])
    test(`@A7 ${width} ${label}: 머리글의 나중에 온 단추가 먼저 그려진 단추를 밀지 않는다 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await watchShifts(page);
      await gotoReady(page, path);
      // The shared search button (the character page's own search form in the slot has the same name).
      await expect(page.locator('header[data-sticky-chrome] [data-slot="command-search-trigger"]')).toBeVisible();
      const load = await shiftsSince(page);
      expect(load.all, `첫 로드 흔들림 (${load.moved})`).toBe(0);
      const late = await partsArriving(page);
      expect(late.value, `머리글 늦게 온 부분이 민 것 (${late.moved})`).toBe(0);
    });
