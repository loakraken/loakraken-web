// 회귀(#1108): 캐릭터 역할에 맞는 아크 그리드 젬 옵션·장신구 연마 줄은 글자색, 다른 역할 줄은 회색.
// 딜러: 공격력·추가 피해·보스 피해(젬), 적주피·추피·공%·무공%(장신구)는 글자색. 서포터는 그 반대.
// 생명력 회복량·상태이상 같은 쓸모 줄은 두 역할 모두 회색. 회색도 글자 대비 AA(4.5:1) 이상.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

/** Contrast ratio of an element's text against the nearest opaque background. */
const contrast = (locator) =>
  locator.evaluate((el) => {
    const rgb = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let bg = null;
    for (let n = el; n && !bg; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      const v = rgb(c);
      if (v.length >= 3 && (v.length < 4 || v[3] === 1)) bg = v;
    }
    const fg = rgb(getComputedStyle(el).color);
    const [a, b] = [lum(fg), lum(bg ?? [255, 255, 255])].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });

const accessoryLine = (page, text) => page.locator("li[data-grade]", { hasText: text }).first();

for (const scheme of ["light", "dark"])
  for (const [name, role] of [["상세", "딜러"], ["상세서포터", "서포터"]])
    test(`${role} ${scheme}: 역할 줄은 글자색, 다른 역할·쓸모 줄은 회색 @regression`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 1280, height: 900 });
      await gotoReady(page, characterPath(name));
      const dealer = role === "딜러";

      // Accessory polish lines (the equipment panel).
      const damage = accessoryLine(page, "적에게 주는 피해 증가 +2.00%");
      const weaponPct = accessoryLine(page, "무기 공격력 +0.80%");
      const regen = accessoryLine(page, "전투 중 생명력 회복량 +50");
      await expect(damage).toBeVisible();
      if (dealer) await expect(damage).not.toHaveAttribute("data-other-role");
      else await expect(damage).toHaveAttribute("data-other-role", "true");
      // 무기 공격력 % counts for both roles.
      await expect(weaponPct).not.toHaveAttribute("data-other-role");
      // Utility lines count for neither.
      await expect(regen).toHaveAttribute("data-other-role", "true");
      expect(await contrast(regen), "회색 줄 글자 대비").toBeGreaterThanOrEqual(4.5);
      // Not by colour alone (WCAG 1.4.1): a grey line says so in words, a counted one does not.
      await expect(regen).toContainText("(이 역할에는 해당 없음)");
      await expect(weaponPct).not.toContainText("이 역할에는 해당 없음");
      if (dealer) await expect(damage).not.toContainText("이 역할에는 해당 없음");
      else await expect(damage).toContainText("(이 역할에는 해당 없음)");

      // Ark grid gem options on the same tab (공격력·보스 피해: the dealer family).
      const core = page.locator("details").filter({ has: page.locator("summary", { hasText: "살상연희" }) }).first();
      await core.locator("summary").click();
      const option = core.locator("small > span", { hasText: /공격력 Lv\.3/ }).first();
      await expect(option).toBeVisible();
      if (dealer) {
        await expect(option).not.toHaveAttribute("data-other-role");
        await expect(option).not.toContainText("이 역할에는 해당 없음");
      } else {
        await expect(option).toHaveAttribute("data-other-role", "true");
        await expect(option).toContainText("(이 역할에는 해당 없음)");
        expect(await contrast(option), "회색 젬 옵션 대비").toBeGreaterThanOrEqual(4.5);
      }
      // Points and willpower have no role: never grey.
      await expect(core.locator("small span", { hasText: /포인트 \d/ }).first()).not.toHaveAttribute("data-other-role");
    });
