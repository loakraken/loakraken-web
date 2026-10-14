// 회귀(A7, #791): 통계 화면에서 서버를 바꿔도(누른 직후 포함) 아무것도 제자리에서 움직이지 않는다.
// 다른 서버의 숫자는 표 칸 너비를 다르게 잡아, 예전 표의 머리 칸과 아래 안내가 그 자리에서 밀렸다.
import { test, expect, gotoReady, chooseOption } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

for (const tab of ["classes", "distribution", "best", "servers", "titles"])
  for (const width of [1280, 360])
    test(`@A7 통계 ${tab} 탭 서버 전환 흔들림 0 @${width} @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, tab === "classes" ? "/stats" : `/stats?tab=${tab}`);
      const server = page.getByRole("combobox", { name: "서버" });
      test.skip(!(await server.isVisible()), "이 탭에는 서버 고르기가 없음");
      // Where each column heading sits: drawn anew, the table must still put
      // them in the same place (fixed widths), or they slide to the eye.
      const headings = () =>
        page.locator("main table").first().evaluate((table) =>
          [...table.querySelectorAll("thead th")].map((th) => {
            const r = th.getBoundingClientRect();
            return [Math.round(r.left), Math.round(r.width)];
          }),
        );
      const hasTable = (await page.locator("main table").count()) > 0;
      const before = hasTable ? await headings() : [];
      const moved = await shiftsDuring(page, () => chooseOption(page, server, "니나브"), 1500);
      await expect(server).toHaveText(/니나브/);
      expect(moved.all, `서버 전환 흔들림 (${moved.moved})`).toBe(0);
      if (hasTable) {
        expect(await headings(), "머리 칸 위치·폭 그대로").toEqual(before);
        // No value cut short by a column too narrow for it.
        const cut = await page.locator("main table").first().evaluate((table) =>
          [...table.querySelectorAll("th, td")].filter((cell) => cell.scrollWidth > cell.clientWidth + 1).map((cell) => cell.textContent.trim()),
        );
        expect(cut, "잘린 칸").toEqual([]);
      }
    });
