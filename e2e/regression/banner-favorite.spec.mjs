// 회귀(#1148): 휴대폰 캐릭터 화면에서 즐겨찾기 단추가 보이지 않았다(탭 줄의 단추는 좁은 화면에서
// 숨고 더보기 메뉴 안에만 있었다). 좁은 화면은 이름 옆에 즐겨찾기 단추: 보이고, 누름 영역 44px,
// 눌림 상태가 읽히고, 이름 줄 높이와 첫 화면 흔들림·누를 때 흔들림 0. 넓은 화면은 탭 줄 단추 그대로.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

const star = (page) => page.getByRole("button", { name: /^즐겨찾기( 해제)?$/ });

for (const scheme of ["light", "dark"])
  for (const width of [320, 360, 390])
    test(`${scheme} ${width}: 이름 옆 즐겨찾기 단추(44px·눌림 상태·흔들림 0) @regression`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 800 });
      await watchShifts(page);
      await gotoReady(page, characterPath("상세"));
      // One visible toggle on a phone, beside the name.
      await expect(star(page)).toHaveCount(1);
      const button = star(page);
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute("aria-pressed", "false");
      const name = page.getByRole("heading", { level: 1, name: "상세" });
      const row = name.locator("..");
      await expect(row.getByRole("button", { name: "즐겨찾기" })).toHaveCount(1);
      // The row is no taller than the name, and the name is not cut.
      const [rowBox, nameBox] = [await row.boundingBox(), await name.boundingBox()];
      expect(rowBox.height, "이름 줄 높이").toBeLessThanOrEqual(nameBox.height + 4 + 0.5);
      expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth + 1), "이름 잘림").toBe(false);
      // 44px to press: a point 20px from the centre in each direction is still the button.
      const hits = await button.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        return [[20, 0], [-20, 0], [0, 20], [0, -20]].map(([dx, dy]) => {
          const hit = document.elementFromPoint(cx + dx, cy + dy);
          return !!hit && el.contains(hit);
        });
      });
      expect(hits, "누름 영역 44px").toEqual([true, true, true, true]);
      expect((await shiftsSince(page)).all, "첫 화면 흔들림").toBe(0);
      const shifts = await shiftsDuring(page, () => button.click(), 300);
      await expect(star(page)).toHaveAttribute("aria-pressed", "true");
      await expect(star(page)).toHaveAccessibleName("즐겨찾기 해제");
      expect(shifts.all, `누를 때 흔들림 (${shifts.moved})`).toBe(0);
      await expectNoHorizontalOverflow(page);
    });

// A37: the longest name the game allows (12 Korean letters) beside the star at
// the narrowest widths: no letter cut, the star stays on the name's first line
// and inside the screen, the server line and the title are not cut either.
const LONGEST = "가나다라마바사아자차카타";
for (const scheme of ["light", "dark"])
  for (const width of [320, 360])
    test(`${scheme} ${width}: 12글자 이름도 잘림 없이 단추가 이름 첫 줄에 @regression`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 800 });
      await gotoReady(page, characterPath("상세"));
      const name = page.getByRole("heading", { level: 1, name: "상세" });
      // Renamed and measured in one step (the locator finds it by the old name).
      const found = await name.evaluate((el, text) => {
        el.textContent = text;
        const row = el.parentElement;
        const star = row.querySelector("button");
        const n = el.getBoundingClientRect();
        const s = star.getBoundingClientRect();
        const line = parseFloat(getComputedStyle(el).lineHeight);
        const cut = (node) => !!node && node.scrollWidth > node.clientWidth + 1;
        const banner = row.parentElement;
        return {
          nameCut: cut(el),
          starOnFirstLine: Math.abs(s.top + s.height / 2 - (n.top + line / 2)) <= 2,
          starInside: s.right <= window.innerWidth,
          linesCut: [...banner.querySelectorAll(":scope > p")].filter(cut).map((p) => p.textContent),
        };
      }, LONGEST);
      expect(found).toEqual({ nameCut: false, starOnFirstLine: true, starInside: true, linesCut: [] });
      await expectNoHorizontalOverflow(page);
    });

test("1280: 이름 옆 단추는 숨고 탭 줄 단추 하나 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, characterPath("상세"));
  await expect(star(page)).toHaveCount(1);
  const row = page.getByRole("heading", { level: 1, name: "상세" }).locator("..");
  await expect(row.getByRole("button")).toHaveCount(0);
});
