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
      const moved = await shiftsDuring(page, () => chooseOption(page, server, "니나브"), 1500);
      await expect(server).toHaveText(/니나브/);
      expect(moved.all, `서버 전환 흔들림 (${moved.moved})`).toBe(0);
    });
