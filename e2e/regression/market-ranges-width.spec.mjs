// 회귀(P1, PM 총괄 11-14; #1608 CI의 bot-notes:22): 시세 추이의 기간 줄(1시간 · 7일 · 30일 · 3개월 · 1년)이 첫 그림에서
// 187 → 224px로 넓어졌다. 사이트 글꼴(display: optional)이 첫 배치 뒤에 오면 기본 글꼴로 잰 단추 폭이 바뀌기 때문.
// 단추 폭은 글꼴과 상관없이 정해져 있어야 한다: 기본 글꼴만 있을 때와 사이트 글꼴일 때 줄과 단추 폭이 같다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const krakenLoaded = (page) => page.evaluate(() => [...document.fonts].some((f) => f.family.includes("kraken") && f.status === "loaded"));
const widths = (page) =>
  page.getByRole("group", { name: "기간" }).evaluate((row) => ({
    row: Math.round(row.getBoundingClientRect().width),
    buttons: [...row.querySelectorAll("button")].map((b) => Math.round(b.getBoundingClientRect().width)),
  }));

for (const width of [1280, 360])
  test(`${width}: 기간 줄과 단추 폭은 글꼴과 상관없이 같다 @regression`, async ({ page, browser }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    // Twice: the second load has the site font from the cache (display: optional uses it then), so the
    // first measure really is in that font.
    await gotoReady(page, "/market");
    await gotoReady(page, "/market");
    await expect(page.getByRole("group", { name: "기간" }).getByRole("button")).toHaveCount(5);
    expect(await krakenLoaded(page), "사이트 글꼴로 그림").toBe(true);
    const site = await widths(page);
    // The same page with the web fonts never arriving: the system face only, as a first visit can paint.
    const bare = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width, height: 900 } });
    const plain = await bare.newPage();
    // As the page fixture: nothing off this site (item icons) is fetched.
    const local = new URL(testInfo.project.use.baseURL).origin;
    await plain.route((url) => url.origin !== local, (route) => route.abort());
    await plain.route(/\.woff2(\?|$)/, (route) => route.abort());
    await plain.goto("/market");
    await expect(plain.getByRole("group", { name: "기간" }).getByRole("button")).toHaveCount(5);
    expect(await krakenLoaded(plain), "사이트 글꼴 없음").toBe(false);
    const fallback = await widths(plain);
    await bare.close();
    expect(fallback, "기본 글꼴일 때도 같은 폭").toEqual(site);
  });
