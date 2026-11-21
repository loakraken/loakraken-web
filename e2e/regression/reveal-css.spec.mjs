// 회귀(#1860, PM 총괄 11-21): 나타나는 움직임(Reveal)을 motion 없이 CSS 전환으로. 느낌은 그대로 — 투명도 + 20px 올라옴,
// 0.55초, 같은 곡선 · 지연. 줄인 움직임에서는 움직이지 않고, JS 없이도 내용이 보이고, 화면 밖이라고 알려 오기 전에는
// 숨기지 않는다. 관찰자는 여백마다 하나를 함께 쓴다(줄마다 하나가 아님).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const tabLink = (page, name) => page.getByRole("navigation", { name: "캐릭터 정보 탭" }).getByRole("link", { name, exact: true });

/** Samples the new tab panel's opacity and transform on every frame for `ms` after it mounts. */
async function samplePanel(page, ms) {
  await page.evaluate((duration) => {
    window.__reveal = [];
    const seen = new Set(document.querySelectorAll("[class*='tabPanel']"));
    const observer = new MutationObserver(() => {
      const panel = [...document.querySelectorAll("[class*='tabPanel']")].find((el) => !seen.has(el));
      if (!panel) return;
      observer.disconnect();
      const start = performance.now();
      const tick = () => {
        const style = getComputedStyle(panel);
        window.__reveal.push({ t: Math.round(performance.now() - start), opacity: Number(style.opacity), transform: style.transform });
        if (performance.now() - start < duration) requestAnimationFrame(tick);
      };
      tick();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }, ms);
}

for (const width of [320, 1280]) {
  test(`${width}: 탭을 바꾸면 패널이 투명도 + 20px로 0.55초 동안 나타나고, 끝은 opacity 1 · transform 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세"));
    await samplePanel(page, 900);
    await tabLink(page, "통계").click();
    await expect.poll(() => page.evaluate(() => window.__reveal.length), { timeout: 5000 }).toBeGreaterThan(10);
    await page.waitForTimeout(1000);
    const samples = await page.evaluate(() => window.__reveal);
    // It starts hidden and lowered (motion took the hidden values on the first frame).
    expect(samples[0].opacity).toBeLessThan(0.5);
    expect(samples[0].transform).toMatch(/matrix\(1, 0, 0, 1, 0, (1\d|20)(\.\d+)?\)/);
    // Mid-way it is between, and it ends shown with no transform (no containing block left behind).
    expect(samples.some((s) => s.opacity > 0.05 && s.opacity < 0.95)).toBe(true);
    const last = samples.at(-1);
    expect(last.opacity).toBe(1);
    expect(last.transform).toBe("none");
    // 0.55s: fully in by ~650ms, not before ~350ms.
    const shownAt = samples.find((s) => s.opacity === 1).t;
    expect(shownAt).toBeGreaterThan(350);
    expect(shownAt).toBeLessThan(800);
  });

  test(`${width}: 줄인 움직임 — 탭을 바꿔도 패널은 처음부터 opacity 1, 움직이지 않음 @regression`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세"));
    await samplePanel(page, 600);
    await tabLink(page, "통계").click();
    await expect.poll(() => page.evaluate(() => window.__reveal.length), { timeout: 5000 }).toBeGreaterThan(5);
    await page.waitForTimeout(700);
    const samples = await page.evaluate(() => window.__reveal);
    expect(samples.every((s) => s.opacity === 1 && s.transform === "none")).toBe(true);
  });
}

test("소개: 화면 밖 내용은 숨었다가 스크롤하면 나타나고, 들어옴 관찰자는 하나뿐 @regression", async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.IntersectionObserver;
    window.__observers = [];
    window.IntersectionObserver = class extends Native {
      constructor(callback, options) {
        super(callback, options);
        window.__observers.push(options?.rootMargin ?? "");
      }
    };
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await gotoReady(page, "/about");
  const below = page.locator("[data-in-view]").last();
  await expect(below).toHaveCSS("opacity", "0");
  await below.scrollIntoViewIfNeeded();
  await expect(below).toHaveCSS("opacity", "1");
  await expect(below).toHaveCSS("transform", "none");
  const margins = await page.evaluate(() => window.__observers);
  expect(margins.filter((m) => m === "0px 0px -40px 0px")).toHaveLength(1);
  expect(await page.locator("[data-in-view]").count()).toBeGreaterThan(3);
});

test.describe("JS 없이", () => {
  test.use({ javaScriptEnabled: false });
  test("소개: 나타나는 내용이 서버 HTML 그대로 보인다(opacity 1) @regression", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/about");
    const heading = page.getByRole("heading", { name: /캐릭터의 지금을/ });
    await expect(heading).toBeVisible();
    for (const selector of ["[class*='sectionHeading']", "[class*='evidenceCopy']"])
      await expect(page.locator(selector).first()).toHaveCSS("opacity", "1");
  });
});
