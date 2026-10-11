// 회귀: 원정대 탭은 통계 화면과 같은 알약 고르기로 한 번에 한 보기만 보여 준다
// (사용자 10-11 지적 6). 기본은 캐릭터, 선택은 ?view=에 남아 공유·새로고침해도 그대로다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("원정대 탭은 캐릭터가 기본이고 칭호·카드 기록을 골라 볼 수 있다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "siblings"));
  const picker = page.getByRole("tablist", { name: "원정대 보기" });
  await expect(picker.getByRole("tab", { name: "캐릭터" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: /합성원정대/ }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "원정대 칭호" })).toHaveCount(0);

  await picker.getByRole("tab", { name: "칭호" }).click();
  await expect(page).toHaveURL(/[?&]view=titles/);
  await expect(page.getByRole("region", { name: "원정대 칭호" })).toBeVisible();
  await expect(page.getByRole("link", { name: /합성원정대/ })).toHaveCount(0);

  await picker.getByRole("tab", { name: "카드 기록" }).click();
  await expect(page).toHaveURL(/[?&]view=cards/);
  await expect(page.getByRole("heading", { name: "원정대 카드 기록" })).toBeVisible();

  // 공유한 주소·새로고침은 고른 보기 그대로.
  await page.reload();
  await expect(picker.getByRole("tab", { name: "카드 기록" })).toHaveAttribute("aria-selected", "true");

  // 캐릭터로 돌아가면 view가 빠진다.
  await picker.getByRole("tab", { name: "캐릭터" }).click();
  await expect(page).not.toHaveURL(/view=/);
});
