// 회귀(L36·K28, API 목록 #4): 랭킹 '길드' 탭 — 확인한 길드원으로 묶은 길드의 아이템 레벨 평균·합 순위.
// 길드원 수는 '확인한' 수라고 적고, 기준(평균↔합)·서버를 바꾸면 순위가 바뀐다. 집계 기준은 길드 단위로.
import { test, expect, gotoReady, chooseOption } from "../support/fixtures.mjs";

test("길드 랭킹: 탭·열·기준 전환·서버·안내 @regression", async ({ page }) => {
  await gotoReady(page, "/rankings?type=guilds");
  await expect(page.getByRole("tab", { name: "길드", selected: true })).toBeVisible();
  const table = page.getByRole("table").first();
  await expect(table.getByRole("columnheader")).toHaveText(["순위", "길드", "서버", "아이템 레벨 평균", "확인한 길드원", "전투력 평균"]);
  await expect(table.getByRole("rowheader")).toHaveText(["합성길드", "두번째길드", "작은길드"]);
  await expect(table.locator("tbody tr").first()).toContainText("24명");
  // Members with a combat power record fewer than the members seen: "n명 기준".
  await expect(table.locator("tbody tr").nth(2)).toContainText("2명 기준");
  await expect(page.getByText(/318개 길드 기준 · 공식 랭킹이 아니에요/)).toBeVisible();
  await expect(page.getByText(/실제 길드 인원이 아니에요/)).toBeVisible();
  await expect(page.getByText(/41개\)/)).toBeVisible();

  await page.getByRole("group", { name: "기준" }).getByRole("button", { name: "아이템 레벨 합" }).click();
  await expect(page).toHaveURL(/sort=SUM/);
  await expect(table.getByRole("columnheader").nth(3)).toHaveText("아이템 레벨 합");
  await expect(table.getByRole("rowheader")).toHaveText(["합성길드", "두번째길드", "작은길드"]);

  // A small sample: values shown as reference, no ranks yet.
  await chooseOption(page, page.getByRole("combobox", { name: "서버" }), "아만");
  await expect(table.getByRole("rowheader")).toHaveText(["합성길드아만", "짧은길드"]);
  await expect(table.locator("tbody tr td").first()).toHaveText("-");
  await expect(page.getByText(/표본 30개 길드가 모이면 순위를 보여 드려요/)).toBeVisible();
});
