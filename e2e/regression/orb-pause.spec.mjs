// 회귀: 반복 애니메이션은 계속 움직이고(사용자 20:58, 5초 자동 멈춤 없앰),
// 히어로 봇 자체를 눌러 멈춤 ↔ 재생한다(WCAG 2.2.2). 멈춰도 봇은 포인터를 계속 따라
// 본다(사용자 11-01). 멈춤은 기억되고, 새로고침하면
// 처음 그릴 때부터 멈춰 있다. 줄어든 모션이면 처음부터 정지라 버튼이 없다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** 지금 실제로 돌고 있는 무한 반복 CSS 애니메이션 수. */
const running = (page) =>
  page.evaluate(() => {
    const scope = document.querySelector("[data-loop]");
    return scope
      .getAnimations({ subtree: true })
      .filter(
        (a) =>
          a.effect?.getTiming().iterations === Infinity &&
          a.playState === "running" &&
          getComputedStyle(a.effect.target).animationPlayState !== "paused",
      ).length;
  });

test.describe("봇 멈춤·재생 @regression", () => {
  for (const path of ["/", "/about"]) {
    test(`${path}: 6초 뒤에도 움직이고, 봇으로 멈추면 새로고침 뒤에도 멈춤`, async ({ page }) => {
      await gotoReady(page, path);
      const orb = page.getByRole("button", { name: "애니메이션 멈춤" });
      await expect(orb).toHaveAttribute("aria-pressed", "false");
      await page.waitForTimeout(6000);
      expect(await running(page)).toBeGreaterThan(0);

      await orb.focus();
      await page.keyboard.press("Enter");
      await expect(orb).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => running(page)).toBe(0);

      if (await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)) {
        // 자동 모션을 멈춰도 사용자가 움직이는 포인터는 계속 따라야 한다.
        const drawn = orb.locator("canvas");
        await expect(drawn).toHaveAttribute("data-bot-turn", /,/);
        const yaw = async () => Number((await drawn.getAttribute("data-bot-turn")).split(",")[0]);
        const hero = await page.locator('section[aria-labelledby="hero-heading"]').boundingBox();
        const body = await orb.boundingBox();
        const y = body.y + body.height / 2;
        await page.mouse.move(hero.x + 4, y, { steps: 10 });
        await expect.poll(yaw).toBeLessThan(-0.2);
        await page.mouse.move(hero.x + hero.width - 4, y, { steps: 10 });
        await expect.poll(yaw).toBeGreaterThan(0.2);
      }

      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          window.__pausedAtLoad = document.documentElement.hasAttribute("data-motion-paused");
        });
      });
      await page.reload();
      expect(await page.evaluate(() => window.__pausedAtLoad)).toBe(true);
      await expect(orb).toHaveAttribute("aria-pressed", "true");
      expect(await running(page)).toBe(0);

      await orb.press("Space");
      await expect(orb).toHaveAttribute("aria-pressed", "false");
      await expect.poll(() => running(page)).toBeGreaterThan(0);
    });
  }

  test("줄어든 모션: 처음부터 정지, 멈춤 버튼 없음", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoReady(page, "/about");
    await expect(page.getByRole("button", { name: "애니메이션 멈춤" })).toHaveCount(0);
    expect(await running(page)).toBe(0);
  });
});
