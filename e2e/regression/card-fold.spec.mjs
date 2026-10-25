// 회귀(#1101): 전투 탭 카드.
// - 각성 점은 카드 그림 아래에 있어 그림 아래 부분(이름판·각성 틀)을 가리지 않는다.
// - '카드 접기'로 카드 그림 목록을 접고 펴며(키보드로도), 단추는 제자리. 기본은 펼침.
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

      // Fold and unfold: open by default, the button stays where it is.
      const fold = panel.getByRole("button", { name: "카드 접기" });
      await expect(fold).toHaveAttribute("aria-expanded", "true");
      // Page coordinates: a shorter page may scroll, which is not the button moving.
      const at = (button) => button.evaluate((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + window.scrollY), Math.round(r.width)]; });
      const before = await at(fold);
      const mark = await shiftMark(page);
      await fold.click();
      await expect(grid).toBeHidden();
      const unfold = panel.getByRole("button", { name: "카드 펴기" });
      await expect(unfold).toHaveAttribute("aria-expanded", "false");
      expect(await at(unfold), "접은 뒤 단추 위치").toEqual(before);
      // The set effects and the roster record stay.
      await expect(panel.getByRole("region", { name: "원정대 카드 기록" })).toBeVisible();
      // Keyboard: Enter on the focused button opens it again.
      await unfold.focus();
      await page.keyboard.press("Enter");
      await expect(grid).toBeVisible();
      await expect(panel.getByRole("button", { name: "카드 접기" })).toHaveAttribute("aria-expanded", "true");
      await page.waitForTimeout(500);
      const toggled = await shiftsSince(page, mark);
      // Only what is under the pressed button may move, and only right after the press.
      expect(toggled.quiet, `접기·펴기 뒤 입력 없는 흔들림 (${toggled.moved})`).toBe(0);
    });
