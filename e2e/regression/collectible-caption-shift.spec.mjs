// 회귀(#1124): 내실 탭의 보유율 설명 줄이 늦게 와서, 한 칸으로 쌓인 화면(360·390)에서
// 아래 특수 장비·성향 칸을 한 줄 밀었다. 설명 줄 자리는 처음부터 잡혀 있고, 응답이
// 늦어도 실패해도 아무것도 움직이지 않는다(A7).
import { test, expect, characterPath } from "../support/fixtures.mjs";

test.use({ hasTouch: true });

const shiftTotal = (page) => page.evaluate(() => window.__shifts.filter((e) => !e.input).reduce((a, e) => a + e.v, 0));

for (const answer of ["delayed", "error"])
  for (const width of [360, 390])
    test(`내실 ${width}: 보유율 응답이 ${answer === "delayed" ? "늦어도" : "실패해도"} 아래 칸이 안 밀린다 @regression`, async ({ page }) => {
      // Tall enough that the side column sits fully on screen (a shift can't hide below the fold).
      await page.setViewportSize({ width, height: 1600 });
      await page.addInitScript(() => {
        window.__shifts = [];
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.__shifts.push({ v: e.value, input: e.hadRecentInput });
        }).observe({ type: "layout-shift", buffered: true });
      });
      let answered = false;
      await page.route("**/collectibles/ownership**", async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        answered = true;
        if (answer === "error")
          await route.fulfill({ status: 503, contentType: "application/json", body: '{"code":"UNAVAILABLE","message":"x"}' });
        else await route.fallback();
      });
      await page.goto(characterPath("전투력계산", "collectibles"));
      await expect(page.getByRole("heading", { name: "특수 장비" })).toBeVisible();
      await expect.poll(() => answered).toBe(true);
      if (answer === "delayed") await expect(page.getByText(/보유율: 크라켄 표본 원정대 [\d,]+개 기준/)).toBeVisible();
      else await expect(page.getByText(/보유율: 크라켄 표본 원정대/)).toHaveCount(0);
      await page.waitForTimeout(500);
      expect(await shiftTotal(page), "보유율 줄이 온 뒤 layout-shift").toBe(0);
    });
