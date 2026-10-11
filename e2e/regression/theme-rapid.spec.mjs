// 회귀: 테마 버튼을 빠르게 여러 번 눌러도 마지막 선택만 남고, 전환 중에
// 색이 섞여 보이지 않는다(사용자 지적 10-11 "여러 번 누르면 가끔 이상").
// 확인: 10회 연타 뒤 html data-theme·저장값·aria-pressed가 모두 같은 상태,
// 누르는 동안 color/background-color 전환이 하나도 돌지 않음.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

test.describe("테마 연타 @regression", () => {
  for (const path of ["/", "/market", "/about"]) {
    test(`${path}: 10회 연타 뒤 상태가 마지막 선택과 같다`, async ({ page }) => {
      await gotoReady(page, path);
      const toggle = page.getByRole("banner").getByRole("button", { name: "다크 모드" });
      await expect(toggle).toBeVisible();

      const result = await toggle.evaluate(async (btn) => {
        const root = document.documentElement;
        const start = root.dataset.theme === "dark";
        let colourTransitions = 0;
        for (let i = 0; i < 10; i++) {
          btn.click();
          colourTransitions += document
            .getAnimations()
            .filter((a) => a.transitionProperty === "color" || a.transitionProperty === "background-color").length;
          await new Promise((r) => setTimeout(r, 20));
        }
        // let the switch settle (two frames) before reading the end state
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
        return {
          start,
          dark: root.dataset.theme === "dark",
          stored: localStorage.getItem("loakraken-theme"),
          pressed: btn.getAttribute("aria-pressed"),
          switching: root.hasAttribute("data-theme-switching"),
          colourTransitions,
        };
      });

      // 10 presses from any start land back on it.
      expect(result.dark).toBe(result.start);
      expect(result.stored).toBe(result.start ? "dark" : "light");
      expect(result.pressed).toBe(String(result.start));
      expect(result.switching).toBe(false);
      expect(result.colourTransitions).toBe(0);

      // One more press is a clean single switch.
      await toggle.click();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.dataset.theme === "dark"))
        .toBe(!result.start);
    });
  }
});
