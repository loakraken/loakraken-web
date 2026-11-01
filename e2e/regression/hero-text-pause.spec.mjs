// 회귀(v0.3.6.1): 봇을 눌러 멈춘 뒤 히어로 위쪽 글(LOAKraken·당신의 캐릭터…·설명)이
// 사라졌다. 한 번만 도는 등장 애니메이션까지 멈춤 규칙에 걸려, 멈춘 채로 다시
// 시작하면(탭을 다시 볼 때, 새로고침) 첫 프레임(투명)에서 멈췄다. 멈춤은 반복
// 모션만 세우고, 글은 언제나 끝 상태(불투명, 제자리)로 보여야 한다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const PAUSE = "애니메이션 멈춤";

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

const setVisibility = (page, state) =>
  page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

test.describe("봇 멈춤 뒤 히어로 글 @regression", () => {
  for (const path of ["/", "/about"]) {
    test(`${path}: 멈춤·탭 전환·새로고침 뒤에도 글이 보이고, 다시 누르면 재생${path === "/" ? " @smoke" : ""}`, async ({ page }) => {
      await gotoReady(page, path);
      const bot = page.getByRole("button", { name: PAUSE });
      await expectTextShown(page, "처음");

      await bot.click();
      await expect(bot).toHaveAttribute("aria-pressed", "true");
      await page.mouse.move(10, 10);
      await expectTextShown(page, "멈춘 뒤");

      // 멈춘 채로 탭을 떠났다 돌아오면 등장 애니메이션이 처음부터 다시 붙는다.
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

      // 재생으로 되돌린 다음 방문에는 등장 애니메이션이 그대로 돈다(꺼 버린 게 아님).
      await page.reload();
      await expect(bot).toHaveAttribute("aria-pressed", "false");
      expect(await page.locator("#hero-heading").evaluate((el) =>
        el.getAnimations().filter((a) => /hero-enter/.test(a.animationName) && a.playState !== "paused").length,
      )).toBe(1);
      await expectTextShown(page, "재생 상태로 새로고침");

      // 등장 도중에 멈춰도 글은 끝 상태까지 간다.
      await page.reload();
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
