// 회귀(#1101): 전투 탭 카드.
// - 각성 점은 카드 그림 아래에 있어 그림 아래 부분(이름판·각성 틀)을 가리지 않는다.
// - 카드 그림은 늘 보이고, 그 아래 세트 효과 목록을 아크 그리드와 같은 화살표 단추로 접고 편다(키보드로도). 기본은 펼침.
// - 첫 로드·입력 없는 흔들림 0, 잘림 0, 가로 넘침 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const scheme of ["light", "dark"])
  for (const width of [320, 360, 390, 1280])
    test(`카드 ${scheme} ${width}: 각성 점은 그림 아래, 접기·펴기 @regression`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, characterPath("상세"));
      const panel = page.getByRole("region", { name: "카드", exact: true });
      const grid = panel.locator(":scope > ul").first();
      await expect(grid).toBeVisible();
      await grid.scrollIntoViewIfNeeded();

      // The pips sit under each picture, never over it.
      const overlaps = await grid.locator("figure").evaluateAll((figures) =>
        figures
          .map((figure) => {
            const frame = figure.firstElementChild.getBoundingClientRect();
            const pips = figure.querySelector("[role=img]").getBoundingClientRect();
            return pips.top >= frame.bottom - 0.5 ? null : figure.querySelector("strong")?.textContent;
          })
          .filter(Boolean),
      );
      expect(overlaps, "그림 위에 겹친 각성 점").toEqual([]);
      const cut = await grid.locator("figcaption strong, figcaption small").evaluateAll((els) =>
        els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
      );
      expect(cut, "카드 이름·각성 잘림").toEqual([]);
      await expectNoHorizontalOverflow(page);
      await page.waitForTimeout(600);
      const loaded = await shiftsSince(page);
      expect(loaded.quiet, `첫 로드 흔들림 (${loaded.moved})`).toBe(0);

      // The pictures always show (no fold on them); the set effects under
      // them fold with the ark grid's toggle (user 10-28), folded by default
      // (user 10-31).
      const sets = panel.locator(":scope > ul").nth(1);
      await expect(sets).toBeHidden();
      await expect(grid).toBeVisible();
      const unfold = panel.getByRole("button", { name: "카드 세트 효과 펼치기" });
      await expect(unfold).toHaveAttribute("aria-expanded", "false");
      const mark = await shiftMark(page);
      await unfold.click();
      await expect(sets).toBeVisible();
      const fold = panel.getByRole("button", { name: "카드 세트 효과 접기" });
      await expect(fold).toHaveAttribute("aria-expanded", "true");
      // The roster record stays.
      await expect(panel.getByRole("region", { name: "원정대 카드 기록" })).toBeVisible();
      // Keyboard: Enter on the focused button folds it again.
      await fold.focus();
      await page.keyboard.press("Enter");
      await expect(sets).toBeHidden();
      await expect(panel.getByRole("button", { name: "카드 세트 효과 펼치기" })).toHaveAttribute("aria-expanded", "false");
      await page.waitForTimeout(500);
      const toggled = await shiftsSince(page, mark);
      // Only what is under the pressed button may move, and only right after the press.
      expect(toggled.quiet, `접기·펴기 뒤 입력 없는 흔들림 (${toggled.moved})`).toBe(0);
    });
