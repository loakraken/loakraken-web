// 회귀(A37·A6, PM 총괄 11-16): 배너 순위 배지는 순위 길이로 정한다. 5자리까지는 어느 너비에서나 한 줄 전체
// ('대양 4,120위 · 상위 22.6%'), 6자리 이상은 400px 아래에서 두 줄(티어·순위 / 상위·비율), 400px부터 한 줄.
// 줄 높이는 첫 그림이 정한다: 서버가 첫 HTML에 순위를 실었으면 그 길이대로, 늦게 온 6자리 순위는 한 줄 자리를
// 그대로 쓰고 400px 아래에서 '상위'를 그리지 않는다(접근 이름에는 남음). 어느 경우에도 배너가 움직이지 않는다.
// 글꼴: 5자리는 사이트 글꼴과 맞춘 대체 글꼴(#1753)에서, 6자리 두 줄은 맞추지 않은 넓은 글꼴(최악)에서도 잰다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { drawnFace } from "../support/fonts.mjs";

const WIDE = `
  @font-face { font-family: "WideFallback"; src: local("DejaVu Sans"), local("DejaVuSans"), local("Verdana"); font-weight: 400; }
  @font-face { font-family: "WideFallback"; src: local("DejaVu Sans Bold"), local("DejaVuSans-Bold"), local("Verdana Bold"), local("Verdana-Bold"); font-weight: 700; }
  html, body, body * { font-family: "WideFallback", "Malgun Gothic", "Noto Sans CJK KR", "WenQuanYi Zen Hei", sans-serif !important; }`;

const rowOf = (page, who) => page.getByRole("region", { name: `${who} 캐릭터 요약` }).locator("p[class*=bannerRank]");

/** The site font in the cache, so the next page draws with it inside its short wait. */
const warmSiteFont = async (page) => {
  await gotoReady(page, "/");
  await page.evaluate(() => Promise.all([document.fonts.load("12px kraken"), document.fonts.load("700 12px kraken")]));
};

/** Every frame's row box from the first paint (x, y, width, height) and whether the badge was in it. */
const recordRowFrames = (page) =>
  page.addInitScript(() => {
    window.__rowFrames = [];
    const sample = () => {
      const row = document.querySelector('[aria-label$="캐릭터 요약"] p[class*=bannerRank]');
      if (row) {
        const r = row.getBoundingClientRect();
        if (r.width > 0 && r.height > 0)
          window.__rowFrames.push({ x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, loaded: !!row.querySelector("button") });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

const expectSteadyRow = async (page) => {
  const frames = await page.evaluate(() => window.__rowFrames);
  expect(frames.some((f) => f.loaded), "순위가 그려진 그림").toBe(true);
  for (const key of ["x", "y", "width", "height"]) {
    const drift = Math.max(...frames.map((f) => Math.abs(f[key] - frames[0][key])));
    expect(drift, `순위 줄 ${key} 변화(px)`).toBe(0);
  }
  return frames;
};

/** The badge's drawn text inside the row: past-the-row px on either side, and the distinct line tops. */
const drawn = (row) =>
  row.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const button = el.querySelector("button");
    const tops = new Set();
    let over = 0;
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      // Not drawn: the hidden sentence, and text kept only for the name (a 1px clipped box).
      if (!n.textContent.trim() || n.parentElement.closest(".sr-only") || n.parentElement.getBoundingClientRect().width <= 1) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 1) continue;
        tops.add(Math.round(r.top));
        over = Math.max(over, box.left - r.left, r.right - box.right);
      }
    }
    return { over, lines: tops.size, height: box.height, scroll: el.scrollWidth - el.clientWidth };
  });

test.describe("배너 순위 길이: 5자리는 한 줄 전체 @A37 @regression", () => {
  test.use({ allowConsoleErrors: true });
  for (const face of ["site", "matched"])
    for (const width of [320, 360, 390])
      test(`${width}px ${face === "site" ? "사이트 글꼴" : "맞춘 대체 글꼴"}: '대양 4,120위 · 상위 22.6%'가 한 줄로 줄 안에`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        if (face === "site") await warmSiteFont(page);
        else await page.route(/\.woff2(\?|$)/, (route) => route.abort());
        await gotoReady(page, characterPath("상세"));
        expect(await drawnFace(page), "그리는 글꼴").toBe(face);
        const row = rowOf(page, "상세");
        const badge = row.getByRole("button", { name: /^대양 4,120위 · 상위 22\.6%, 전투력 순위\. .*공식 순위가 아니에요\.$/ });
        await expect(badge).toBeVisible();
        await expect(badge.locator("[class*=bannerRankText]")).toHaveText("대양 4,120위 · 상위 22.6%", { useInnerText: true });
        const d = await drawn(row);
        expect(d.lines, "한 줄").toBe(1);
        expect(d.height, "줄 높이").toBe(26);
        expect(d.over, "줄 밖으로 나간 글자(px)").toBeLessThanOrEqual(0);
        expect(d.scroll, "가로 넘침").toBeLessThanOrEqual(0);
      });
});

test.describe("배너 순위 길이: 6자리는 400px 아래 두 줄 @A37 @regression", () => {
  test.use({ reducedMotion: "reduce" });
  for (const width of [320, 360, 390])
    test(`${width}px 넓은 시스템 글꼴: '연안 123,456위 / 상위 49.98%' 두 줄이 첫 그림부터 줄 안에`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((css) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      }, WIDE);
      await recordRowFrames(page);
      await gotoReady(page, characterPath("순위큰수"));
      const used = await page.evaluate(async () => {
        await Promise.all([document.fonts.load("12px WideFallback"), document.fonts.load("700 12px WideFallback")]);
        return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "WideFallback" && f.status === "loaded");
      });
      expect(used, "넓은 대체 글꼴(DejaVu Sans·Verdana)이 실제로 쓰였다").toBe(true);
      const row = rowOf(page, "순위큰수");
      // The name starts with the two lines as shown, then says the rest.
      const badge = row.getByRole("button", { name: /^연안 123,456위\s+상위 49\.98%, 전투력 순위\. / });
      await expect(badge).toBeVisible();
      await expect(badge.locator("[class*=bannerRankText]")).toHaveText(/^연안 123,456위\s*\n\s*상위 49\.98%$/, { useInnerText: true });
      const d = await drawn(row);
      expect(d.lines, "두 줄").toBe(2);
      expect(d.height, "줄 높이").toBe(40);
      expect(d.over, "줄 밖으로 나간 글자(px)").toBeLessThanOrEqual(0);
      expect(d.scroll, "가로 넘침").toBeLessThanOrEqual(0);
      // Two lines tall from the first paint (the server's answer was in the first HTML).
      const frames = await expectSteadyRow(page);
      expect(frames[0].height).toBe(40);
    });

  for (const width of [400, 1280])
    test(`${width}px 사이트 글꼴: 6자리도 한 줄 전체`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await warmSiteFont(page);
      await gotoReady(page, characterPath("순위큰수"));
      expect(await drawnFace(page), "그리는 글꼴").toBe("site");
      const row = rowOf(page, "순위큰수");
      const badge = row.getByRole("button", { name: /123,456위 · 상위 49\.98%, 전투력 순위/ });
      await expect(badge).toContainText("123,456위 · 상위 49.98%", { useInnerText: true });
      const d = await drawn(row);
      expect(d.lines, "한 줄").toBe(1);
      expect(d.height, "줄 높이").toBe(26);
      expect(d.over, "줄 밖으로 나간 글자(px)").toBeLessThanOrEqual(0);
    });
});

test.describe("배너 순위 길이: 늦게 온 6자리는 한 줄 자리에 짧은 꼴 @A6 @A37 @regression", () => {
  test.use({ reducedMotion: "reduce" });
  for (const width of [320, 360, 390])
    test(`${width}px: 첫 그림 뒤에 온 6자리 순위는 '상위' 없이 한 줄, 배너가 움직이지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await warmSiteFont(page);
      await recordRowFrames(page);
      // The mock answers after the page's 1s wait: the first HTML has the empty one-line row.
      await page.goto(characterPath("순위큰수늦음"), { waitUntil: "domcontentloaded" });
      const row = rowOf(page, "순위큰수늦음");
      const badge = row.getByRole("button", { name: /^연안 123,456위 · 상위 49\.98%, 전투력 순위\. / });
      await expect(badge).toBeVisible({ timeout: 10_000 });
      expect(await drawnFace(page), "그리는 글꼴").toBe("site");
      // 상위 stays in the name but is not drawn (a 1px clipped box).
      await expect(badge.locator("[class*=bannerRankText]")).toContainText("연안 123,456위 · ", { useInnerText: true });
      expect((await badge.locator("[class*=bannerRankTopWord]").boundingBox())?.width ?? 0, "'상위'를 그리지 않음").toBeLessThanOrEqual(1);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const d = await drawn(row);
      expect(d.lines, "한 줄").toBe(1);
      expect(d.height, "줄 높이").toBe(26);
      expect(d.over, "줄 밖으로 나간 글자(px)").toBeLessThanOrEqual(0);
      const frames = await expectSteadyRow(page);
      expect(frames.some((f) => !f.loaded), "순위 전 빈 줄로 먼저 그림").toBe(true);
    });
});
