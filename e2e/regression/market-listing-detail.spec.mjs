// v0.3.2(사용자 요청): 보석·장신구 시세판의 매물 이름을 누르면 상세 카드가 뜬다(악세 경매 검색 줄 상세와
// 같은 부품). 카드는 이미 받은 매물 값만 쓰고 요청을 더 보내지 않는다. 열고 닫을 때(누른 직후 포함) 흔들림 0,
// 카드 안 가격·효과 줄은 잘리지 않고(A37), Esc로 닫히면 초점이 이름으로 돌아온다. 1분 갱신이 와도 열린
// 카드는 닫히지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const BOARDS = [
  { name: "보석", path: "/market/gems?kind=겁화&level=10", table: "보석 매물", kind: "보석", effect: null },
  { name: "장신구", path: "/market/accessories?slot=NECKLACE&levels=HIGH", table: "장신구 매물", kind: "목걸이", effect: "연마 효과" },
];
const cut = (els) =>
  els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => `${el.textContent.trim()} ${el.clientWidth}<${el.scrollWidth}`);

for (const width of [1280, 360])
  for (const board of BOARDS)
    test(`@시세판상세 ${width} ${board.name}: 이름을 누르면 상세 카드, 흔들림 0·잘림 없음·Esc 초점·요청 없음 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install();
      await watchShifts(page);
      await gotoReady(page, board.path);
      const table = page.getByRole("region", { name: board.table });
      // The name itself is the button (the row header reads the same name).
      const open = table.getByRole("rowheader").first().getByRole("button");
      await expect(open).toHaveAttribute("aria-haspopup", "dialog");
      await expect(open).toBeVisible();
      await page.waitForTimeout(600);

      const asked = [];
      page.on("request", (r) => new URL(r.url()).pathname.startsWith("/api/") && asked.push(new URL(r.url()).pathname));
      const opening = await shiftsDuring(page, () => open.click());
      expect(opening.all, `여는 흔들림 (${opening.moved})`).toBe(0);
      const card = page.getByRole("dialog");
      await expect(card).toBeVisible();
      await expect(card).toContainText(board.kind);
      await expect(card).toContainText("즉시 구매가");
      await expect(card).toContainText(/거래 \d+회 가능|거래 불가|거래 횟수 정보 없음/);
      await expect(card).toContainText("기준 매물");
      if (board.effect) await expect(card).toContainText(board.effect);
      expect(await card.locator("*").evaluateAll(cut), "카드 안 잘린 줄").toEqual([]);
      expect(asked, "카드를 열어도 요청 없음").toEqual([]);

      // The minute's refresh of the board does not close it.
      await page.clock.fastForward(61_000);
      await page.waitForTimeout(500);
      await expect(card).toBeVisible();

      // Focus is back on a name at once (not after the sheet's slide), also when
      // closing drew the rows again for the refreshed page.
      let focusedRightAway = null;
      const closing = await shiftsDuring(page, async () => {
        await page.keyboard.press("Escape");
        focusedRightAway = await page.evaluate(() => document.activeElement?.closest("th[scope=row] button")?.textContent ?? null);
      });
      expect(focusedRightAway, "Esc 직후 초점이 이름 버튼").not.toBeNull();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(closing.all, `닫는 흔들림 (${closing.moved})`).toBe(0);
      await expect(open).toBeFocused();
    });

// Touch: the card is a bottom sheet, which hands focus back only after its
// 500ms closing slide. The name takes it at once instead.
test.describe("터치 시트", () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  for (const board of BOARDS)
    test(`@시세판상세 터치 ${board.name}: 시트를 Esc로 닫으면 바로 이름에 초점 @regression`, async ({ page }) => {
      await gotoReady(page, board.path);
      const open = page.getByRole("region", { name: board.table }).getByRole("rowheader").first().getByRole("button");
      await open.tap();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.waitForTimeout(700);
      await page.keyboard.press("Escape");
      const focused = await page.evaluate(() => document.activeElement?.closest("th[scope=row] button")?.textContent ?? null);
      expect(focused, "Esc 직후 초점이 이름 버튼").toBe(await open.textContent());
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(open).toBeFocused();
    });
});