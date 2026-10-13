// 회귀(A6·A7): 캐릭터 탭 줄의 갱신 버튼은 남은 시간('3분 30초' → '3분 9초' → '갱신')이 바뀌어도
// 폭이 그대로라 옆의 분석·공유·즐겨찾기 버튼이 움직이지 않는다. 시계를 흘려 보내며 잰다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360])
  test(`@A7 갱신 버튼 남은 시간이 바뀌어도 폭·위치 그대로 @${width} @regression`, async ({ page }) => {
    await page.clock.install();
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    const refresh = page.locator("button[data-no-replay]").first();
    await expect(refresh).toContainText(/\d+분 \d+초|\d+초|갱신/);
    const box = async () => {
      const b = await refresh.boundingBox();
      return [Math.round(b.x), Math.round(b.width)];
    };
    // The page clock is faked (performance.now too): shifts are told by the running total.
    await page.waitForTimeout(500);
    let total = (await shiftsSince(page)).all;
    const first = await box();
    const labels = [await refresh.innerText()];
    // Through two-digit and one-digit seconds and minutes, down to "갱신".
    for (const step of [21_000, 60_000, 60_000, 60_000, 60_000]) {
      await page.clock.runFor(step);
      await page.waitForTimeout(300);
      labels.push(await refresh.innerText());
      const now = await shiftsSince(page);
      expect(+(now.all - total).toFixed(4), `남은 시간 ${labels.at(-1)} 흔들림 (${now.moved})`).toBe(0);
      total = now.all;
      expect(await box(), `갱신 버튼 위치·폭 (${labels.join(" → ")})`).toEqual(first);
    }
  });
