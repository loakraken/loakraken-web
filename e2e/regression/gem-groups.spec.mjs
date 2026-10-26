// 회귀(#1100): 캐릭터 보석은 위에 피해 증가(겁화·피해 광휘), 아래에 재사용 대기시간 감소(작열·재사용 광휘).
// 첫 그림부터 같은 배치, 흔들림 0, 잘림 0, 가로 넘침 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const scheme of ["light", "dark"])
  for (const width of [320, 360, 390, 1280])
    test(`보석 ${scheme} ${width}: 피해 묶음 위, 재사용 묶음 아래 @regression`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      // 10겁화, 8작열, 6광휘(피해), 7광휘(재사용) in the mock.
      await gotoReady(page, characterPath("광휘보석"));
      const panel = page.getByRole("region", { name: "보석", exact: true });
      const damage = panel.getByRole("region", { name: "피해 증가" });
      const cooldown = panel.getByRole("region", { name: "재사용 대기시간 감소" });
      await expect(damage.getByRole("heading")).toHaveText("피해 증가 2");
      await expect(cooldown.getByRole("heading")).toHaveText("재사용 대기시간 감소 2");
      await expect(damage.locator("li > span[data-gem]")).toHaveText(["10겁", "6겁"]);
      await expect(cooldown.locator("li > span[data-gem]")).toHaveText(["8작", "7작"]);
      const [top, bottom] = await Promise.all([damage.boundingBox(), cooldown.boundingBox()]);
      expect(bottom.y, "재사용 묶음이 피해 묶음 아래").toBeGreaterThanOrEqual(top.y + top.height);
      const cut = await panel.locator("h3, li > span[data-gem]").evaluateAll((els) =>
        els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
      );
      expect(cut, "잘림").toEqual([]);
      await expectNoHorizontalOverflow(page);
      await page.waitForTimeout(600);
      const loaded = await shiftsSince(page);
      expect(loaded.all, `첫 로드 흔들림 (${loaded.moved})`).toBe(0);
    });
