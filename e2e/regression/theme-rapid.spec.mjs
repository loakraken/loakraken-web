// 회귀: 테마를 빠르게 여러 번 바꿔도 마지막 선택만 남고, 전환 중에
// 색이 섞여 보이지 않는다(사용자 지적 10-11 "여러 번 누르면 가끔 이상").
// 테마는 라이트·딤·다크·시스템 네 가지(PM 10-11): 헤더 버튼 하나가 4칸
// 라디오 패널을 연다. 확인: 화살표 10회 연타 뒤 html data-theme·저장값·
// aria-checked가 모두 같은 상태, 바꾸는 동안 color/background-color 전환 0개.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const ORDER = ["light", "dim", "dark", "system"];

test.describe("테마 연타 @regression", () => {
  for (const path of ["/", "/market", "/about"]) {
    test(`${path}: 화살표 10회 연타 뒤 상태가 마지막 선택과 같다`, async ({ page }) => {
      await gotoReady(page, path);
      const trigger = page.getByRole("banner").getByRole("button", { name: "화면 테마" });
      await trigger.click();
      const group = page.getByRole("radiogroup", { name: "화면 테마" });
      await expect(group).toBeVisible();

      const result = await group.evaluate(async (el) => {
        const root = document.documentElement;
        let colourTransitions = 0;
        for (let i = 0; i < 10; i++) {
          document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
          colourTransitions += document
            .getAnimations()
            .filter((a) => a.transitionProperty === "color" || a.transitionProperty === "background-color").length;
          await new Promise((r) => setTimeout(r, 20));
        }
        // let the switch settle (two frames) before reading the end state
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
        return {
          theme: root.dataset.theme ?? "light",
          stored: localStorage.getItem("loakraken-theme"),
          checked: el.querySelector('[aria-checked="true"]')?.textContent,
          focused: document.activeElement?.textContent,
          switching: root.hasAttribute("data-theme-switching"),
          colourTransitions,
        };
      });

      // From the default, system (the fourth), 10 steps round four choices
      // land on the second: dim (user decision 10-18: system by default).
      expect(ORDER[(3 + 10) % 4]).toBe("dim");
      expect(result.theme).toBe("dim");
      expect(result.stored).toBe("dim");
      expect(result.checked).toBe("딤");
      expect(result.focused).toBe("딤");
      expect(result.switching).toBe(false);
      expect(result.colourTransitions).toBe(0);

      // Esc closes the panel and returns focus to the button.
      await page.keyboard.press("Escape");
      await expect(group).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }
});

test.describe("테마 4종 @regression", () => {
  test("딤을 고르면 새로고침 뒤에도 첫 화면부터 딤", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByRole("banner").getByRole("button", { name: "화면 테마" }).click();
    await page.getByRole("radio", { name: "딤" }).click();
    await expect(page.getByRole("radiogroup")).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dim");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(34, 37, 43)");

    // The pre-paint script sets it before any script of the page runs.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        window.__themeAtLoad = document.documentElement.dataset.theme;
      });
    });
    await page.reload();
    expect(await page.evaluate(() => window.__themeAtLoad)).toBe("dim");
    await page.getByRole("banner").getByRole("button", { name: "화면 테마" }).click();
    await expect(page.getByRole("radio", { name: "딤" })).toHaveAttribute("aria-checked", "true");
  });

  test("예전 저장값 dark·light는 그대로 읽힌다", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("loakraken-theme", "dark"));
    await gotoReady(page, "/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("시스템은 OS 설정을 실시간으로 따른다", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => localStorage.setItem("loakraken-theme", "system"));
    await gotoReady(page, "/");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  });

  // 사용자 결정 10-18: 저장값이 없으면 시스템(전에는 라이트, D3). 저장된 선택은 그대로.
  for (const os of ["light", "dark"])
    test(`저장값이 없으면 시스템을 따른다: OS ${os}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: os });
      await gotoReady(page, "/");
      const html = page.locator("html");
      await expect(html).toHaveAttribute("data-theme-choice", "system");
      if (os === "dark") await expect(html).toHaveAttribute("data-theme", "dark");
      else await expect(html).not.toHaveAttribute("data-theme");
      // The header button shows the system icon, and the choice is not written down.
      expect(await page.evaluate(() => localStorage.getItem("loakraken-theme"))).toBeNull();
      // Following the OS while nothing is stored.
      await page.emulateMedia({ colorScheme: os === "dark" ? "light" : "dark" });
      if (os === "dark") await expect(html).not.toHaveAttribute("data-theme");
      else await expect(html).toHaveAttribute("data-theme", "dark");
    });

  test("저장된 라이트는 OS가 다크여도 라이트", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => localStorage.setItem("loakraken-theme", "light"));
    await gotoReady(page, "/");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    await expect(page.locator("html")).toHaveAttribute("data-theme-choice", "light");
  });
});
