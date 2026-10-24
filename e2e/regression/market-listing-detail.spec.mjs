// 사용자 10-24: 보석·장신구 시세판의 매물 이름 끝 화살표로 그 줄 바로 아래에 상세(아이템 그림·등급·효과·경매)를
// 펼친다(아크 그리드 펼침과 같은 방식, 떠 있는 카드 없음). 이미 받은 매물 값만 쓰고 요청을 더 보내지 않는다.
// 누른 줄은 제자리이고, 아래 내용은 누른 직후에만 밀린다(입력 없는 흔들림 0). 여러 줄을 함께 펼칠 수 있고,
// 같은 화살표로 접힌다. 320·360·390·1280에서 가로 넘침 없음.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

// The listings box scrolls sideways on a phone by design, never up and down: a
// press area or ring past the last row would add a vertical scrollbar.
const extraHeight = (table) => table.evaluate((t) => { const box = t.closest('[data-slot="data-table"]'); return box.scrollHeight - box.clientHeight; });

const BOARDS = [
  { name: "보석", path: "/market/gems?kind=겁화&level=10", table: "보석 매물", kind: "보석", effect: "보석 효과" },
  { name: "장신구", path: "/market/accessories?slot=NECKLACE&levels=HIGH", table: "장신구 매물", kind: "목걸이", effect: "연마 효과" },
];

for (const width of [320, 360, 390, 1280])
  for (const board of BOARDS)
    test(`@시세판상세 ${width} ${board.name}: 화살표로 줄 아래 펼침·접힘, 요청 없음, 넘침 없음 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, board.path);
      const table = page.getByRole("region", { name: board.table });
      const first = table.getByRole("rowheader").first().getByRole("button");
      await expect(first).toHaveAttribute("aria-expanded", "false");
      await expectNoHorizontalOverflow(page);
      await page.waitForTimeout(600);

      const asked = [];
      page.on("request", (r) => new URL(r.url()).pathname.startsWith("/api/") && asked.push(new URL(r.url()).pathname));
      const before = await first.boundingBox();
      const opening = await shiftsDuring(page, () => first.click());
      expect(opening.quiet, `펼친 뒤 늦은 흔들림 (${opening.moved})`).toBe(0);
      expect(Math.round((await first.boundingBox()).y), "누른 줄은 제자리").toBe(Math.round(before.y));
      await expect(first).toHaveAttribute("aria-expanded", "true");
      const id = await first.getAttribute("aria-controls");
      const detail = page.locator(`#${id}`);
      // The details row comes right after the listing's own row.
      expect(await detail.evaluate((row, header) => row.previousElementSibling?.contains(header), await first.elementHandle())).toBe(true);
      await expect(detail).toContainText(board.kind);
      await expect(detail).toContainText(board.effect);
      await expect(detail).toContainText("즉시 구매가");
      await expect(detail).toContainText(/거래 \d+회 가능|거래 불가|거래 횟수 정보 없음/);
      await expect(detail).toContainText("기준 매물");
      await expect(detail.locator("img")).toHaveAttribute("src", /^https:\/\/cdn-lostark\.game\.onstove\.com\//);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(asked, "펼쳐도 요청 없음").toEqual([]);
      await expectNoHorizontalOverflow(page);
      expect(await extraHeight(table), "매물 상자 세로 넘침(px)").toBe(0);

      // A second row opens too; the first stays open.
      const second = table.getByRole("rowheader").nth(1).getByRole("button");
      await second.click();
      await expect(second).toHaveAttribute("aria-expanded", "true");
      await expect(first).toHaveAttribute("aria-expanded", "true");

      // The same arrow folds it (keyboard too), and focus stays on it.
      await first.press("Enter");
      await expect(first).toHaveAttribute("aria-expanded", "false");
      await expect(detail).toHaveCount(0);
      await expect(first).toBeFocused();
    });

// Another page starts folded, and so does the first page on the way back
// (the same listing would otherwise open by itself and push the rows down).
test("@시세판상세 보석: 다른 쪽으로 가면 펼친 줄이 접힘 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market/gems?kind=겁화&level=10");
  const table = page.getByRole("region", { name: "보석 매물" });
  const first = table.getByRole("rowheader").first().getByRole("button");
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  const pager = page.getByRole("navigation", { name: "매물 쪽 이동" });
  await pager.getByRole("button", { name: "2", exact: true }).click();
  await expect(pager.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(table.getByRole("button", { expanded: true })).toHaveCount(0);
  await pager.getByRole("button", { name: "1", exact: true }).click();
  await expect(pager.getByRole("button", { name: "1", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(table.getByRole("button", { expanded: true })).toHaveCount(0);
});

// Touch: the same arrow, a 44px press area, no sheet.
test.describe("터치", () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  for (const board of BOARDS)
    test(`@시세판상세 터치 ${board.name}: 탭하면 줄 아래 펼침, 시트 없음 @regression`, async ({ page }) => {
      await gotoReady(page, board.path);
      const open = page.getByRole("region", { name: board.table }).getByRole("rowheader").first().getByRole("button");
      await open.tap();
      await expect(open).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(`#${await open.getAttribute("aria-controls")}`)).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      expect(await extraHeight(page.getByRole("region", { name: board.table })), "매물 상자 세로 넘침(px)").toBe(0);
    });
});
