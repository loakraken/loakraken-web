// 회귀(P1, PM 총괄 11-14; #1608 CI의 bot-notes:22): 시세 추이의 기간 줄(1시간 · 7일 · 30일 · 3개월 · 1년)이 첫 그림에서
// 187 → 224px로 넓어졌다. 사이트 글꼴(display: optional)이 첫 배치 뒤에 오면 기본 글꼴로 잰 단추 폭이 바뀌기 때문.
// 단추 폭은 글꼴과 상관없이 정해져 있어야 한다: 기본 글꼴만 있을 때와 사이트 글꼴일 때 줄과 단추 폭이 같다.
// #1628: 보석 · 장신구 칸의 최저가 추이 기간 줄(7일 · 30일 · 3개월 · 1년)도 같다. 그리고 '사이트 글꼴로 잼'은 파일을
// 받았는지가 아니라 실제로 그 글꼴로 그렸는지로 확인한다(글자 폭이 기본 글꼴과 다름): 두 쪽이 모두 기본 글꼴이면
// 고치기 전 코드에서도 통과할 수 있었다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const PAGES = [
  { path: "/market", count: 5 },
  { path: "/market/gems", count: 4 },
];

// The row, each button, and each label's drawn text width (the glyphs as rendered, unrounded).
const measure = (page) =>
  page.getByRole("group", { name: "기간" }).evaluate((row) => ({
    row: Math.round(row.getBoundingClientRect().width),
    buttons: [...row.querySelectorAll("button")].map((b) => Math.round(b.getBoundingClientRect().width)),
    text: [...row.querySelectorAll("button")].reduce((sum, b) => {
      const range = document.createRange();
      range.selectNodeContents(b);
      return sum + range.getBoundingClientRect().width;
    }, 0),
  }));

// The site font, drawn for sure: display: optional may keep the system face for this visit, so the
// same file (from the page's own @font-face) is loaded as a face that is ready before it is used.
const useSiteFont = (page) =>
  page.evaluate(async () => {
    const rule = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .find((r) => r instanceof CSSFontFaceRule && r.style.getPropertyValue("font-family").includes("kraken"));
    if (!rule) return false;
    // The url() is relative to the stylesheet, not the page: resolve it there first.
    const [, file] = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue("src")) ?? [];
    if (!file) return false;
    const href = new URL(file, rule.parentStyleSheet?.href ?? location.href).href;
    const face = new FontFace("kraken-drawn", `url("${href}")`, { weight: "400 700" });
    document.fonts.add(await face.load());
    document.documentElement.style.setProperty("--font-kraken", "kraken-drawn");
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return document.fonts.check('600 12px "kraken-drawn"');
  });

for (const { path, count } of PAGES)
  for (const width of [1280, 360, 320])
    test(`${width} ${path}: 기간 줄과 단추 폭은 글꼴과 상관없이 같다 @regression`, async ({ page, browser }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, path);
      await expect(page.getByRole("group", { name: "기간" }).getByRole("button")).toHaveCount(count);
      expect(await useSiteFont(page), "사이트 글꼴 준비").toBe(true);
      const site = await measure(page);
      // The same page with the web fonts never arriving: the system face only, as a first visit can paint.
      const bare = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width, height: 900 } });
      const plain = await bare.newPage();
      // As the page fixture: nothing off this site (item icons) is fetched.
      const local = new URL(testInfo.project.use.baseURL).origin;
      await plain.route((url) => url.origin !== local, (route) => route.abort());
      await plain.route(/\.woff2(\?|$)/, (route) => route.abort());
      await plain.goto(path);
      await expect(plain.getByRole("group", { name: "기간" }).getByRole("button")).toHaveCount(count);
      const fallback = await measure(plain);
      await bare.close();
      // Proof the two really are drawn in different faces: otherwise equal widths prove nothing.
      expect(Math.abs(site.text - fallback.text), `글자 폭이 달라야 함 (사이트 ${site.text}, 기본 ${fallback.text})`).toBeGreaterThan(1);
      expect({ row: fallback.row, buttons: fallback.buttons }, "기본 글꼴일 때도 같은 폭").toEqual({ row: site.row, buttons: site.buttons });
    });

// codex #1629 P3: the font changing while the page is open (not only two finished pages). One page drawn in the
// system face (the site font held back), then the site font put in: the labels redraw in it, and the row and every
// button keep their widths, with no layout shift on the row.
for (const { path, count } of PAGES)
  for (const width of [1280, 320])
    test(`${width} ${path}: 화면을 연 뒤 글꼴이 바뀌어도 기간 줄은 움직이지 않는다 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      let release;
      const gate = new Promise((resolve) => (release = resolve));
      await page.route(/\.woff2(\?|$)/, async (route) => {
        await gate;
        await route.continue();
      });
      // Not gotoReady: its network wait would sit on the held font.
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const group = page.getByRole("group", { name: "기간" });
      await expect(group.getByRole("button")).toHaveCount(count);
      await page.waitForFunction(() => Object.keys(document.body).some((key) => key.startsWith("__reactFiber$")));
      const before = await measure(page);
      await group.evaluate((row) => {
        window.__rowShifts = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            if (entry.sources?.some((s) => s.node && row.contains(s.node))) window.__rowShifts.push(entry.value);
        }).observe({ type: "layout-shift" });
      });
      release();
      expect(await useSiteFont(page), "사이트 글꼴 준비").toBe(true);
      const after = await measure(page);
      expect(Math.abs(after.text - before.text), `글자 폭이 바뀌어야 함 (전 ${before.text}, 후 ${after.text})`).toBeGreaterThan(1);
      expect({ row: after.row, buttons: after.buttons }, "글꼴이 바뀐 뒤에도 같은 폭").toEqual({ row: before.row, buttons: before.buttons });
      expect(await page.evaluate(() => window.__rowShifts.reduce((a, b) => a + b, 0)), "기간 줄 흔들림").toBe(0);
    });
