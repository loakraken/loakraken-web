// 회귀: 개인정보 처리방침에 시세 알림(켠 경우)과 원정대 불러오기 '불러온 적 있음' 표시 줄이 있다.
// 기능 플래그와 상관없이 늘 보인다(문구가 '켠 경우' 조건부). 360에서도 가로로 넘치지 않는다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

for (const width of [1280, 360])
  test(`처리방침 시세 알림·불러온 적 있음 줄 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/privacy");
    const main = page.getByRole("main");
    await expect(main.getByRole("rowheader", { name: "시세 알림을 켠 경우(선택)" })).toBeVisible();
    await expect(main.getByRole("rowheader", { name: "시세 알림 구독 정보·조건" })).toBeVisible();
    await expect(main.getByRole("rowheader", { name: /^원정대 불러오기 '불러온 적 있음' 표시/ })).toBeVisible();
    await expect(main.getByRole("heading", { name: "국외 이전 상세 (브라우저 푸시 서비스)" })).toBeVisible();
    await expect(main.getByText(/처리정지된 캐릭터도 게임 정보 없이 '불러온 적 있음' 표시/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
