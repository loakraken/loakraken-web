// 회귀(L13·K11·L44, API 목록 #5): 칭호 장착 비율 — 통계 '칭호' 탭(확인한 원정대 중 그 칭호를 장착한 원정대 비율)과
// 원정대 칭호 목록의 '장착 원정대 x%'. 장착만 셈(보유 아님)을 화면에 적는다.
import { test, expect, characterPath, gotoReady, chooseOption } from "../support/fixtures.mjs";

test("통계 칭호 탭: 비율 표·서버 바꾸기·장착만 안내 @regression", async ({ page }) => {
  await gotoReady(page, "/stats?tab=titles");
  await expect(page.getByRole("tab", { name: "칭호", selected: true })).toBeVisible();
  const table = page.getByRole("table", { name: "칭호 장착 원정대 비율" });
  await expect(table.getByRole("rowheader")).toHaveText(["빛을 꺼트리는 자", "에키드나를 쓰러뜨린 자", "별을 제패한 자"]);
  await expect(table.locator("tbody tr").first()).toContainText("400개");
  await expect(table.locator("tbody tr").first()).toContainText("32.26%");
  await expect(page.getByText(/장착하지 않은 칭호는 알 수 없어 세지 않아요/)).toBeVisible();

  await chooseOption(page, page.getByRole("combobox", { name: "서버" }), "아만");
  await expect(page).toHaveURL(/server=/);
  await expect(page.getByText(/표본 30개 원정대 미만이라 참고값/)).toBeVisible();
});

test("원정대 칭호: 칭호마다 장착 원정대 비율 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "siblings"));
  await page.getByRole("tab", { name: "칭호" }).click();
  const list = page.getByRole("list").filter({ hasText: "빛을 꺼트리는 자" }).first();
  await expect(list).toContainText("장착 원정대 32.26%");
  // A title not in the shares (no record of anyone wearing it) shows no share.
  // The title line itself (a same-day group is an outer list item too).
  const kamen = page.getByText("카멘을 쓰러뜨린 자", { exact: true }).locator("xpath=..");
  await expect(kamen).not.toContainText("장착 원정대");
});
