// 회귀(A7, #791): 통계 화면에서 서버를 바꿔도(누른 직후 포함) 아무것도 제자리에서 움직이지 않는다.
// 다른 서버의 숫자는 표 칸 너비를 다르게 잡아, 예전 표의 머리 칸과 아래 안내가 그 자리에서 밀렸다.
// 조건 막대(참고 구조, 11-01)의 역할·기간·전투력 범위도 같다. 표본 줄은 폰 폭(320)에서 두 줄이 된다.
import { test, expect, gotoReady, chooseOption, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const tab of ["classes", "distribution", "servers", "titles", "population"])
  for (const width of [1280, 360, 320])
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
      // The page never widens past the screen (the table box scrolls instead, #811).
      await expectNoHorizontalOverflow(page);
    });

for (const width of [1280, 320])
  test(`@A7 통계 조건 막대: 첫 로드·역할·기간·전투력 범위 흔들림 0 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/stats");
    await page.waitForTimeout(600);
    expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);
    const bar = page.getByRole("form", { name: "통계 조건" });
    for (const [group, choice] of [["역할", "서포터"], ["기간", "7일"]]) {
      const radio = bar.getByRole("radiogroup", { name: group }).getByRole("radio", { name: choice });
      const moved = await shiftsDuring(page, () => radio.click(), 1500);
      await expect(radio).toBeChecked();
      expect(moved.all, `${group} 흔들림 (${moved.moved})`).toBe(0);
    }
    const typed = await shiftsDuring(page, () => bar.getByRole("textbox", { name: "전투력 최소" }).fill("2000"), 1500);
    await expect(page).toHaveURL(/combatPowerMin=2000/);
    expect(typed.all, `전투력 범위 흔들림 (${typed.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
