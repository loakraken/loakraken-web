// 회귀: 숙제 주간 초기화 남은 시간은 사이트 공통 형식이다(사용자 19:32, web #372).
// 1시간 미만이면 "M분 SS초"로 1초마다 움직이고, 1시간 이상이면 "H시간 M분".
// 주간 초기화: 수요일 06:00 KST(2026-10-14 06:00 KST = 2026-10-13T21:00Z).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const RESET = Date.parse("2026-10-13T21:00:00Z");

test("1시간 미만이면 초까지 1초마다 움직인다 @regression", async ({ page }) => {
  await page.clock.install({ time: RESET - (25 * 60 + 3) * 1000 });
  await gotoReady(page, "/tools/homework");
  const left = page.locator("dt", { hasText: "주간 초기화까지" }).locator("xpath=following-sibling::dd[1]");
  await expect(left).toHaveText(/^25분 0[0-3]초$/);
  const first = await left.innerText();
  await page.clock.runFor(2000);
  await expect(left).not.toHaveText(first);
  await expect(left).toHaveText(/^25분 0\d초$/);
});

test("1시간 이상이면 시간과 분, '0시간'은 없다 @regression", async ({ page }) => {
  await page.clock.install({ time: RESET - (2 * 3600 + 5 * 60) * 1000 });
  await gotoReady(page, "/tools/homework");
  const left = page.locator("dt", { hasText: "주간 초기화까지" }).locator("xpath=following-sibling::dd[1]");
  await expect(left).toHaveText("2시간 5분");
});
