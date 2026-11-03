// 회귀(#1333, A6·A7): 첫 로드에서 페이지가 나뉘어 오면(앞부분이 먼저 그려짐) 머리글의 나중에 온 단추가 이미 그려진 단추를
// 밀지 않는다. 메뉴 단추는 900px 이하에서 맨 오른쪽에 보이지만 페이지에서는 검색·테마보다 앞이라, 그것만 먼저 그려지면 로고
// 바로 옆에 있다가 뒤의 단추가 오며 오른쪽 끝으로 밀렸고(360, 메뉴 단추 144→302), 넓은 화면에서는 맨 끝의 테마 단추가 늦게
// 오며 검색·디스코드를 왼쪽으로 밀었다(1280). 이제 단추마다 머리글 안의 자리가 정해져 있다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

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
  // 420/421 and 900/901: where the Discord button goes away and where the menu turns into one button.
  for (const width of [320, 360, 420, 421, 768, 900, 901, 1280])
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

// A wider font for the Discord label (a fallback, or the web font landing late) widens nothing but the label: the
// page slot beside it and the buttons stay (CI's font is narrow enough that this never shows otherwise, #1359 review).
for (const width of [901, 1280])
  test(`@A7 ${width} 캐릭터: 디스코드 글자가 넓은 글꼴이 되어도 머리글의 다른 부분은 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    await expect(page.locator('header[data-sticky-chrome] [data-slot="command-search-trigger"]')).toBeVisible();
    const moved = await shiftsDuring(
      page,
      () => page.addStyleTag({ content: "header[data-sticky-chrome] a[href*='discord'] span { font-family: monospace !important; letter-spacing: 4px !important; }" }),
      300,
    );
    expect(moved.all, `넓은 글꼴의 디스코드가 민 것 (${moved.moved})`).toBe(0);
    // Even this extreme label runs on inside the bar: the page never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });

// A plain system fallback (the web font not loaded in time) keeps the label inside its gap: it does not reach the
// search button beside it (#1359 review).
for (const width of [901, 1280])
  test(`${width} 캐릭터: 대체 글꼴의 디스코드 글자는 옆 검색 단추에 닿지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await gotoReady(page, characterPath("상세"));
    await page.addStyleTag({ content: "header[data-sticky-chrome] a[href*='discord'] span { font-family: sans-serif !important; }" });
    const gap = await page.evaluate(() => {
      const header = document.querySelector("header[data-sticky-chrome]");
      const label = header.querySelector("a[href*='discord'] span").getBoundingClientRect();
      const search = header.querySelector('[data-slot="command-search-trigger"]').getBoundingClientRect();
      return Math.round(search.left - label.right);
    });
    expect(gap, "디스코드 글자 끝과 검색 단추 사이").toBeGreaterThanOrEqual(0);
  });
