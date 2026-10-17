// 회귀: /rankings 원정대 탭(백엔드 #298) — 종류 탭으로 들어가 기준·계산을 바꾸고, 구성 캐릭터를 펼쳐 본다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

test("원정대 랭킹: 탭 전환, 식스맨 평균·상위 6명 합, 구성 펼치기 @regression", async ({ page }) => {
  await gotoReady(page, "/rankings");
  const tabs = page.getByRole("tablist", { name: "랭킹 종류" });
  await tabs.getByRole("tab", { name: "원정대" }).click();
  await expect(page).toHaveURL(/type=roster/);
  const table = page.getByRole("table");
  await expect(table).toContainText("합성원정대");
  await expect(table.getByRole("columnheader", { name: "식스맨 평균" })).toBeVisible();
  // 6명보다 적은 원정대는 인원 칸에 표시(값은 그래도 ÷ 6, api #530).
  await expect(table.getByRole("row", { name: /작은원정대/ })).toContainText("4명");
  // Which characters count and how the 식스맨 is divided, as the backend counts it (api #530).
  const note = page.getByText(/^원정대는 서버를 고르면 그 서버/);
  await expect(note).toContainText("고르지 않으면 대표 캐릭터의 서버");
  await expect(note).toContainText("인원·전체 평균도 그 서버 기준");
  await expect(note).toContainText("아이템 레벨이 높은 6명");
  await expect(note).toContainText("전투력 합을 6으로 나눠요");
  await expect(note).toContainText("6명보다 적어도 6으로 나눠요");
  await expect(note).not.toContainText("있는 인원으로");

  await page.getByRole("button", { name: "상위 6명 합" }).click();
  await expect(page).toHaveURL(/aggregate=TOP6_SUM/);
  await expect(table.getByRole("columnheader", { name: "상위 6명 합" })).toBeVisible();

  await table.getByText("6명 보기").first().click();
  await expect(table.getByRole("link", { name: "합성원정대2" })).toBeVisible();

  await tabs.getByRole("tab", { name: "캐릭터" }).click();
  await expect(page).not.toHaveURL(/type=roster/);
});
