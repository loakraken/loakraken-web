// 회귀(사용자 11-08): 소개(/about)는 처음 열 때 스스로 지어진다. 팀마다 색이 다른 화살표 커서 12개(이름표 없음)가
// 한 번에 한 구역씩(넷까지) 점선 상자를 끌고, 회색 뼈대가 나온 뒤 진짜 내용이 들어선다. 제목은 위에 겹친 글자로 타이핑.
// 첫 화면은 6초 안, 아래 구역은 화면에 오면, 휴대폰(≤480)에서는 일하는 커서만 보인다. 흔들림 0, 다 지으면 그리기 반복이
// 멈춘다. 건너뛰기 단추, 줄인 동작·멈춤을 고른 방문자·JS 없음은 처음부터 완성된 페이지, 이 탭에서 한 번만.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince, shiftMark } from "../support/shifts.mjs";

const KEY = "loakraken:about-intro";
const INTRO = "about-intro";
// The fixtures mark the intro as played (other /about specs see the finished page): this file plays it.
const fresh = (page) => page.addInitScript((key) => sessionStorage.removeItem(key), KEY);
const introOn = (page) => page.evaluate((c) => document.documentElement.classList.contains(c), INTRO);
const unbuilt = (page, scope = "") =>
  page.evaluate((s) => document.querySelectorAll(`${s} [data-build-block]:not([data-built])`).length, scope);
const shownCursors = (page) =>
  page.evaluate(() => [...document.querySelectorAll("[data-intro-cursor]")].filter((c) => getComputedStyle(c).opacity !== "0").length);

async function scrollThrough(page) {
  // Down a section at a time: each builds when it comes on screen, one after another.
  for (const id of ["preview", "evidence", "roadmap", "closing"]) {
    await page.locator(`[data-build-section="${id}"]`).scrollIntoViewIfNeeded();
    await expect.poll(() => unbuilt(page, `[data-build-section="${id}"]`), { timeout: 15_000 }).toBe(0);
  }
}

for (const width of [320, 390, 1280])
  for (const theme of ["light", "dark"])
    test(`소개 ${width} ${theme}: 커서 12개가 구역마다 짓고, 흔들림 0, 다 지으면 멈춘다 @regression`, async ({ page }) => {
      test.setTimeout(90_000);
      await fresh(page);
      await page.addInitScript((t) => localStorage.setItem("loakraken-theme", t), theme);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await watchShifts(page);
      await page.goto("/about");
      expect(await introOn(page), "첫 그림 전에 켜짐").toBe(true);
      // The headline (the page's largest text, LCP) is never hidden, and no hidden
      // block could become a later, larger LCP: no image, no text larger than the h1.
      // Text is sized as LCP sizes it: the box round an element's text, clipped to the
      // first screen (a block whose top edge only peeks in is not a large candidate).
      const lcp = await page.evaluate(() => {
        const textArea = (el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = [...range.getClientRects()].filter((r) => r.width && r.height);
          if (!rects.length) return 0;
          const left = Math.max(0, Math.min(...rects.map((r) => r.left)));
          const right = Math.min(innerWidth, Math.max(...rects.map((r) => r.right)));
          const top = Math.max(0, Math.min(...rects.map((r) => r.top)));
          const bottom = Math.min(innerHeight, Math.max(...rects.map((r) => r.bottom)));
          return Math.max(0, right - left) * Math.max(0, bottom - top);
        };
        // The LCP candidates in a block: every element with text of its own.
        const texts = (block) =>
          [block, ...block.querySelectorAll("*")].filter((el) =>
            [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
          );
        const h1 = document.querySelector("h1");
        const hidden = [...document.querySelectorAll("[data-build-block]")].filter(
          (b) => getComputedStyle(b).opacity === "0" && b.getBoundingClientRect().top < innerHeight,
        );
        return {
          h1: getComputedStyle(h1).opacity,
          images: hidden.flatMap((b) => [...b.querySelectorAll("img, video, svg image")]).length,
          largerText: hidden.filter((b) => b.dataset.buildKind === "text" && texts(b).some((el) => textArea(el) >= textArea(h1))).length,
        };
      });
      expect(lcp, "제목은 처음부터 보이고, 숨긴 칸은 LCP가 될 수 없음").toEqual({ h1: "1", images: 0, largerText: 0 });
      // The blocks are in the page (their boxes held), only hidden until built.
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("[data-intro-cursor]")).toHaveCount(12);
      // Plain arrows: no name tags anywhere in the layer.
      await expect(page.locator("[data-intro-layer]")).toHaveText("");
      if (width <= 480) await expect.poll(() => shownCursors(page), { message: "휴대폰은 일하는 커서만" }).toBeLessThanOrEqual(4);
      // Cursors waiting at the edges never widen the page.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "가로 넘침").toBe(0);
      await expect(page.getByRole("button", { name: "소개 건너뛰기" })).toBeVisible();
      // The first screen is up within 6 s.
      await expect.poll(() => unbuilt(page, '[data-build-section="intro"]'), { timeout: 6_000, intervals: [200] }).toBe(0);
      await scrollThrough(page);
      await expect.poll(() => introOn(page), { timeout: 5_000 }).toBe(false);
      await expect(page.locator("html")).toHaveAttribute("data-intro-loop", "parked");
      await expect(page.locator("[data-intro-cursor]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "소개 건너뛰기" })).toHaveCount(0);
      const shift = await shiftsSince(page);
      expect(shift.all, `흔들림 (${shift.moved})`).toBe(0);
    });

test("소개: 건너뛰기를 누르면 바로 완성, 그리기 반복 멈춤, 이 탭에 기록 @regression", async ({ page }) => {
  await fresh(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");
  const skip = page.getByRole("button", { name: "소개 건너뛰기" });
  await skip.focus();
  await page.keyboard.press("Enter");
  expect(await introOn(page)).toBe(false);
  expect(await unbuilt(page)).toBe(0);
  await expect(page.locator("[data-intro-layer]")).toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("data-intro-loop", "parked");
  await expect(skip).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // The hero does not enter a second time once the class is gone: nothing in it
  // animates, and every block is fully shown in place.
  const hero = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-build-section="intro"] [data-build-block]')].map((b) => ({
        running: b.getAnimations().length,
        opacity: getComputedStyle(b).opacity,
        transform: getComputedStyle(b).transform,
      })),
    );
  await expect.poll(async () => (await hero()).filter((b) => b.running).length).toBe(0);
  const settled = await hero();
  for (const b of settled) expect(b.opacity).toBe("1");
  // A few frames later, still the same (no entrance replaying from opacity 0 or an offset).
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300)))));
  expect(await hero()).toEqual(settled);
  // Played: recorded for this tab, so the next load shows the finished page (next test).
  expect(await page.evaluate((key) => sessionStorage.getItem(key), KEY)).toBe("1");
});

test("소개: 짓는 중에 키를 누르면(예: Tab으로 검색칸) 바로 완성되어 방해하지 않는다 @regression", async ({ page }) => {
  await fresh(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/about");
  expect(await introOn(page)).toBe(true);
  // Hydrated (the intro listens from here on): its skip button is up.
  await expect(page.getByRole("button", { name: "소개 건너뛰기" })).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await introOn(page)).toBe(false);
  expect(await unbuilt(page)).toBe(0);
  await expect(page.locator("[data-intro-cursor]")).toHaveCount(0);
});

test.describe("스크립트가 오지 않으면", () => {
  test.use({ allowConsoleErrors: true });
  test("소개 안전 시계: 3초 안에 소개가 시작되지 않으면 완성된 페이지를 보인다 @regression", async ({ page }) => {
    await fresh(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // The page's scripts never arrive (a slow or failed bundle): only the pre-paint script runs.
    await page.route(/\/_next\/static\/chunks\/.+\.js(\?.*)?$/, (route) => route.abort());
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/about");
    expect(await introOn(page)).toBe(true);
    await expect.poll(() => introOn(page), { timeout: 6_000 }).toBe(false);
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll("[data-build-block]")].filter((b) => getComputedStyle(b).opacity === "0").length);
    expect(hidden).toBe(0);
  });

  test("소개 안전 시계: 스크립트가 3초 넘게 늦게 와도, 시계가 보인 완성된 페이지는 깨어날 때 다시 숨지 않는다 @regression", async ({ page }) => {
    await fresh(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // The page's scripts arrive late (a slow device or network): held past the 3 s
    // timer, then let through, so the page wakes after the timer showed it finished.
    let release;
    const held = new Promise((resolve) => (release = resolve));
    const chunks = /\/_next\/static\/chunks\/.+\.js(\?.*)?$/;
    await page.route(chunks, async (route) => {
      await held;
      await route.continue();
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/about", { waitUntil: "commit" });
    await expect.poll(() => introOn(page), { message: "첫 그림 전에 켜짐" }).toBe(true);
    await expect.poll(() => introOn(page), { timeout: 6_000, message: "안전 시계가 끔" }).toBe(false);
    // From here, every frame: is the intro (which hides the blocks) on again?
    await page.evaluate((c) => {
      window.__onAgain = 0;
      const tick = () => {
        if (document.documentElement.classList.contains(c)) window.__onAgain++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, INTRO);
    release();
    await page.unroute(chunks);
    await expect(page.locator('[data-motion="on"]'), "깨어남").toHaveCount(1);
    // A fixed wait proves an absence: nothing turns the intro back on after waking.
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => window.__onAgain), "깨어난 뒤 소개가 다시 켜진 프레임").toBe(0);
    await expect(page.locator("[data-intro-cursor]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "소개 건너뛰기" })).toHaveCount(0);
  });
});

test("소개: 이 탭에서 이미 봤으면 다시 지어지지 않는다 @regression", async ({ page }) => {
  // The fixtures' init script marks it played, as the page itself does at the end.
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/about");
  expect(await introOn(page)).toBe(false);
  await expect(page.locator("[data-intro-cursor]")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

for (const [name, setup] of [
  ["줄인 동작", (page) => page.emulateMedia({ reducedMotion: "reduce" })],
  ["멈춤을 고른 방문자", (page) => page.addInitScript(() => localStorage.setItem("loakraken-motion", "paused"))],
])
  test(`소개 ${name}: 소개 없이 그대로의 페이지, 커서 없음 @regression`, async ({ page }) => {
    test.setTimeout(60_000);
    await fresh(page);
    await setup(page);
    await page.setViewportSize({ width: 390, height: 900 });
    await gotoReady(page, "/about");
    expect(await introOn(page)).toBe(false);
    await expect(page.locator("[data-intro-cursor]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "소개 건너뛰기" })).toHaveCount(0);
    // Nothing on the first screen is hidden. Below it, the page's own scroll
    // reveal stays as it was before the intro: with motion paused (only the
    // looping motion stops) a block fades in when it comes on screen; under
    // reduced motion everything is shown at once.
    // (the reveal counts a block on screen once its top is 40px inside the bottom edge)
    const hidden = () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll("[data-build-block]")].filter(
            (b) => getComputedStyle(b).opacity !== "1" && b.getBoundingClientRect().top < innerHeight - 40,
          ).length,
      );
    await expect.poll(hidden, { message: "첫 화면에 숨은 칸" }).toBe(0);
    // Reduced motion: nothing anywhere on the page is hidden, from the load on.
    if (name === "줄인 동작") {
      const anywhere = await page.evaluate(
        () => [...document.querySelectorAll("[data-build-block]")].filter((b) => getComputedStyle(b).opacity !== "1").length,
      );
      expect(anywhere, "줄인 동작: 숨은 칸 없음").toBe(0);
    }
    // Each block, brought on screen, is shown (a tall section is not on one screen).
    const blocks = page.locator("[data-build-block]");
    const n = await blocks.count();
    // The page's blocks are all there (the loop below cannot pass on none).
    expect(n, "지을 칸 수").toBeGreaterThan(15);
    for (let i = 0; i < n; i++) {
      await blocks.nth(i).scrollIntoViewIfNeeded();
      await expect.poll(() => blocks.nth(i).evaluate((b) => getComputedStyle(b).opacity), { timeout: 5_000 }).toBe("1");
    }
  });

test.describe("JS 없이", () => {
  test.use({ javaScriptEnabled: false });
  test("소개 JS 없이: 숨기지 않고 내용이 그대로 보인다 @regression", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/about");
    await expect(page.locator("html")).not.toHaveClass(new RegExp(INTRO));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

// 회귀(사용자 11-08): 머리글 메뉴의 '소개'(같은 문서 안의 이동)로 열어도 소개가 지어진다. 인라인 스크립트는
// 이때 돌지 않으므로 화면이 처음 그려지기 전에 같은 판단을 한다: 지을 칸이 보였다가 숨는 일 없음, 흔들림 0.
// 다 지은 뒤 뒤로·앞으로 가면 이 탭에서 이미 봤으니 완성된 페이지 그대로.
for (const width of [390, 1280])
  test(`소개 ${width}: 머리글 메뉴로 열어도 지어지고, 보였다 숨는 칸 없음, 뒤로·앞으로는 완성된 페이지 @regression`, async ({ page }) => {
    test.setTimeout(90_000);
    await fresh(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await watchShifts(page);
    await gotoReady(page, "/");
    // From here on, every frame until /about's blocks first exist: how many of the
    // ones still to be built are drawn visible in that first frame (must be none).
    await page.evaluate(() => {
      window.__shownEarly = null;
      const tick = () => {
        const blocks = [...document.querySelectorAll('[data-build-block]:not([data-build-kind="keep"]):not([data-built])')];
        if (blocks.length) window.__shownEarly = blocks.filter((b) => getComputedStyle(b).opacity !== "0").length;
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const nav = page.getByRole("navigation", { name: "주요 메뉴" });
    if (width <= 480) {
      await nav.getByRole("button", { name: "메뉴 열기" }).click();
      await nav.getByRole("link", { name: /서비스 소개/ }).click();
    } else await nav.getByRole("link", { name: "소개", exact: true }).click();
    await expect(page).toHaveURL(/\/about#intro$/);

    await expect.poll(() => page.evaluate(() => window.__shownEarly), { message: "첫 그림에 보인 지을 칸" }).toBe(0);
    expect(await introOn(page), "같은 문서 안의 이동에도 켜짐").toBe(true);
    const mark = await shiftMark(page);
    await expect(page.locator("[data-intro-cursor]")).toHaveCount(12);
    await expect(page.getByRole("button", { name: "소개 건너뛰기" })).toBeVisible();
    await expect.poll(() => unbuilt(page, '[data-build-section="intro"]'), { timeout: 6_000, intervals: [200] }).toBe(0);
    await scrollThrough(page);
    await expect.poll(() => introOn(page), { timeout: 5_000 }).toBe(false);
    await expect(page.locator("[data-intro-cursor]")).toHaveCount(0);
    const shift = await shiftsSince(page, mark);
    expect(shift.all, `흔들림 (${shift.moved})`).toBe(0);
    expect(await page.evaluate((k) => sessionStorage.getItem(k), KEY), "이 탭에 기록").toBe("1");

    // Back to the home page and forward again (both inside this document): already
    // played in this tab, so the page comes back finished and the intro stays off.
    await page.goBack();
    await expect(page).not.toHaveURL(/\/about/);
    await page.goForward();
    await expect(page).toHaveURL(/\/about#intro$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // A fixed wait proves an absence: the intro does not turn on a moment later.
    await page.waitForTimeout(500);
    expect(await introOn(page), "뒤로·앞으로: 소개 꺼짐").toBe(false);
    await expect(page.locator("[data-intro-cursor]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "소개 건너뛰기" })).toHaveCount(0);
  });
