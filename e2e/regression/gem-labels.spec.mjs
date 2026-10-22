// 회귀(사용자 의견 10-22): 보석은 '10겁 8작'으로 읽는다. 전투 탭 보석 칸·요약과 스킬 탭 칩 모두
// 겁·작(4티어; 광휘는 공식 효과로 겁/작), 공식 이름(6레벨 광휘의 보석)은 카드에만. 넘침 없음, 첫 로드 흔들림 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const scheme of ["light", "dark"])
  for (const width of [320, 360, 390, 1280])
    test(`@보석겁작 ${scheme} ${width} 전투·스킬 탭 겁/작 @regression`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, characterPath("광휘보석"));
      const panel = page.getByRole("region", { name: "보석", exact: true });
      await expect(panel.locator("header")).toContainText("평균 7.75 · 겁 2 · 작 2");
      const chips = panel.locator("li > span[data-gem]");
      await expect(chips).toHaveText(["10겁", "8작", "6겁", "7작"]);
      await expect(chips.nth(2)).toHaveAttribute("data-gem", "damage");
      await expect(chips.nth(3)).toHaveAttribute("data-gem", "cooldown");
      // The official name is not on screen (screen readers still get it).
      const fullName = await panel.getByText("6레벨 광휘의 보석").boundingBox();
      expect(fullName.width <= 1 && fullName.height <= 1, "공식 이름은 화면 밖(읽기용)").toBe(true);
      await expect(panel).not.toContainText(/뎀|쿨 \d|\d광휘/);
      await page.waitForTimeout(600);
      expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);
      await expectNoHorizontalOverflow(page);

      await gotoReady(page, characterPath("광휘보석", "skills"));
      // The fixture's listed skill (테스트 스킬) carries all four gems.
      const row = page.getByRole("listitem").filter({ hasText: "테스트 스킬" }).getByLabel("보석", { exact: true }).first();
      await expect(row.locator("> span")).toHaveText(["10겁", "8작", "6겁", "7작"]);
      await expect(page.getByRole("group", { name: "보석으로 거르기" })).toContainText("겁화만");
      await expectNoHorizontalOverflow(page);
    });
