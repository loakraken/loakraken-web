// 회귀(v0.3.6.1): 봇을 눌러 멈춘 뒤 히어로 위쪽 글(LOAKraken·당신의 캐릭터…·설명)이
// 사라졌다. 한 번만 도는 등장 애니메이션까지 멈춤 규칙에 걸려, 멈춘 채로 다시
// 시작하면(탭을 다시 볼 때, 새로고침) 첫 프레임(투명)에서 멈췄다. 멈춤은 반복
// 모션만 세우고, 글은 언제나 끝 상태(불투명, 제자리)로 보여야 한다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const PAUSE = "애니메이션 멈춤";
/** The page's script chunks, not its CSS (held back to replay a slow hydration). */
const CHUNKS = /\/_next\/static\/chunks\/.*\.js(\?|$)/;

/**
 * The page is hydrated: its motion scope is on. The first HTML already has the bot
 * (aria-pressed="false"), but the scope is "off" there (the server cannot know the
 * tab is shown), and a click on the bot does nothing until the page wakes.
 */
const hydrated = (page) => expect(page.locator('[data-motion="on"]')).toHaveCount(1);

/** 등장 애니메이션이 붙은 히어로 글마다: 불투명도·세로 이동·히어로 안에 다 들어오는지. */
const heroText = (page) =>
  page.evaluate(() => {
    const hero = document.querySelector('section[aria-labelledby="hero-heading"]');
    const box = hero.getBoundingClientRect();
    return [...hero.querySelectorAll('[class*="heroEnter"]')].map((el) => {
      let opacity = 1;
      for (let node = el; node && node !== hero.parentElement; node = node.parentElement)
        opacity *= Number(getComputedStyle(node).opacity);
      const r = el.getBoundingClientRect();
      const shift = new DOMMatrix(getComputedStyle(el).transform).m42;
      const inside = r.width > 0 && r.height > 0 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5;
      return { text: el.textContent.trim().slice(0, 12), opacity, shift, inside };
    });
  });

/** 글이 3개 이상이고 모두 불투명·제자리·안 잘림이 될 때까지 기다린다. 실패하면 마지막에 본 문제 글이 남는다. */
async function expectTextShown(page, when) {
  await expect
    .poll(async () => {
      const items = await heroText(page);
      if (items.length < 3) return `글 ${items.length}개`;
      return JSON.stringify(items.filter((i) => !(i.opacity === 1 && Math.abs(i.shift) < 0.5 && i.inside)));
    }, { message: when, timeout: 3000 })
    .toBe("[]");
}

/** 지금 실제로 돌고 있는 무한 반복 CSS 애니메이션 수 (orb-pause.spec 과 같은 기준). */
const running = (page) =>
  page.evaluate(() =>
    document
      .querySelector("[data-loop]")
      .getAnimations({ subtree: true })
      .filter(
        (a) =>
          a.effect?.getTiming().iterations === Infinity &&
          a.playState === "running" &&
          getComputedStyle(a.effect.target).animationPlayState !== "paused",
      ).length,
  );

/** hero-enter animations on the heading (finished ones count: the entrance holds its end state). */
const entrances = (heading) =>
  heading.evaluate((el) => el.getAnimations().filter((a) => /hero-enter/.test(a.animationName) && a.playState !== "paused").length);

/**
 * Opens `path` by a link inside the site, so the client puts the hero in the page
 * (no first HTML for it). Checks it really stayed one document.
 */
async function openByLink(page, path) {
  await gotoReady(page, "/market");
  await page.waitForFunction(() => window.__lkHydrated);
  await page.evaluate(() => (window.__sameDocument = true));
  if (path === "/") await page.getByRole("link", { name: "LOAKraken 홈" }).click();
  else await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "소개", exact: true }).click();
  await expect(page).toHaveURL(path === "/" ? /\/$/ : /\/about#intro$/);
  await hydrated(page);
  expect(await page.evaluate(() => window.__sameDocument), "링크로 연 같은 문서").toBe(true);
}

const setVisibility = (page, state) =>
  page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

test.describe("봇 멈춤 뒤 히어로 글 @regression", () => {
  for (const path of ["/", "/about"]) {
    test(`${path}: 멈춤·탭 전환·새로고침 뒤에도 글이 보이고, 다시 누르면 재생${path === "/" ? " @smoke" : ""}`, async ({ page }) => {
      await gotoReady(page, path);
      await hydrated(page);
      const bot = page.getByRole("button", { name: PAUSE });
      await expectTextShown(page, "처음");

      await bot.click();
      await expect(bot).toHaveAttribute("aria-pressed", "true");
      await page.mouse.move(10, 10);
      await expectTextShown(page, "멈춘 뒤");

      // 멈춘 채로 탭을 떠났다 돌아와도 글은 그대로 보인다.
      await setVisibility(page, "hidden");
      await setVisibility(page, "visible");
      await expectTextShown(page, "멈춘 채 탭 전환 뒤");

      // 멈춤은 기억되므로 새로고침하면 첫 그림부터 멈춰 있다.
      await page.reload();
      await expect(bot).toHaveAttribute("aria-pressed", "true");
      await expectTextShown(page, "멈춘 채 새로고침 뒤");

      await bot.click();
      await expect(bot).toHaveAttribute("aria-pressed", "false");
      await expect.poll(() => running(page)).toBeGreaterThan(0);
      await expectTextShown(page, "다시 재생");

      // 처음 HTML은 제목을 끝 상태로 그리고(LCP: 불투명도 0에서 시작하지 않음), 페이지가 깨어날 때
      // 다시 사라졌다 올라오지 않는다(#1441: 느린 기기에서 글이 한 번 깜빡였다).
      // The script chunks arrive late (a slow device): for a while only the first HTML is
      // there. The heading is fully shown from it, and waking the page must not hide it again.
      let release;
      const held = new Promise((resolve) => (release = resolve));
      await page.route(CHUNKS, async (route) => {
        await held;
        await route.continue();
      });
      await page.reload({ waitUntil: "commit" });
      await expect(bot).toHaveAttribute("aria-pressed", "false");
      const heading = page.locator("#hero-heading");
      expect(
        await heading.evaluate((el) => ({ opacity: getComputedStyle(el).opacity, entering: el.getAnimations().length })),
        "처음 그림에서 제목이 끝 상태(LCP)",
      ).toEqual({ opacity: "1", entering: 0 });
      // From here, every frame: the lowest opacity the heading shows.
      await heading.evaluate((el) => {
        window.__lowest = 1;
        const tick = () => {
          window.__lowest = Math.min(window.__lowest, Number(getComputedStyle(el).opacity));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      release();
      await page.unroute(CHUNKS);
      await hydrated(page);
      // A fixed wait proves an absence: no second entrance (750 ms) starts after waking.
      await page.waitForTimeout(1000);
      expect(await page.evaluate(() => window.__lowest), "깨어난 뒤 제목이 다시 사라지지 않음").toBe(1);
      expect(await entrances(heading), "깨어날 때 등장 없음").toBe(0);
      await expectTextShown(page, "재생 상태로 새로고침");

      // 다른 화면에서 링크로 열면(처음 HTML이 그리지 않은 히어로) 등장 애니메이션이 돈다(꺼 버린 게 아님).
      // 그 도중에 멈춰도 글은 끝 상태까지 간다.
      await openByLink(page, path);
      expect(await entrances(heading), "링크로 열면 등장").toBe(1);
      await bot.click();
      await expect(bot).toHaveAttribute("aria-pressed", "true");
      await expectTextShown(page, "등장 도중 멈춤");
    });
  }

  test("줄어든 모션: 처음부터 글이 끝 상태로 보임 @smoke", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoReady(page, "/");
    await expect(page.getByRole("button", { name: PAUSE })).toHaveCount(0);
    await expectTextShown(page, "줄어든 모션");
  });
});
