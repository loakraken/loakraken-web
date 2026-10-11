// 회귀: 전투정보실 페이지 정보(트라이포드 레벨·스킬 코드)는 백엔드 플래그를 따른다(PM 19:53).
// 켜짐(목 '상세')이면 트라이포드 레벨 배지와 '스킬 코드 복사'가 보이고, 꺼짐(그 밖)이면 둘 다 없다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("전투정보실 페이지 정보가 켜지면 트라이포드 레벨과 스킬 코드 복사가 보인다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "skills"));
  await expect(page.getByRole("button", { name: "스킬 코드 복사" })).toBeVisible();
  await expect(page.getByText("기동 포격 레벨 5")).toHaveCount(1);
});

test("꺼지면 트라이포드 레벨과 스킬 코드 복사가 없다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세서포터", "skills"));
  await expect(page.getByRole("region", { name: "정보" })).toBeVisible();
  await expect(page.getByRole("button", { name: "스킬 코드 복사" })).toHaveCount(0);
  await expect(page.locator("[class*=tripodIcon] b")).toHaveCount(0);
});
