// 회귀: /rankings 수집품 탭(백엔드 #295·#304, 체크리스트 K33) — 종류 탭으로 들어가 진행도와 종류별 점수를 보고,
// 캐릭터 단위로 바꿔 본다. 대표 캐릭터는 그 캐릭터의 수집품 탭으로 이어진다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

test("수집품 랭킹: 탭 전환, 진행도·점수, 종류별 펼치기, 캐릭터 단위 @regression", async ({ page }) => {
  await gotoReady(page, "/rankings");
  const tabs = page.getByRole("tablist", { name: "랭킹 종류" });
  await tabs.getByRole("tab", { name: "수집품" }).click();
  await expect(page).toHaveURL(/type=collectibles/);
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader", { name: "대표 캐릭터" })).toBeVisible();
  const top = table.getByRole("row", { name: /합성원정대/ });
  await expect(top).toContainText("100.00%");
  await expect(top).toContainText("1,684 / 1,684");
  await expect(top).toContainText("8명");
  await expect(table.getByRole("link", { name: "상세 수집품 보기" })).toHaveAttribute("href", /\/character\/.+\?tab=collectibles$/);

  await top.getByText("3종 보기").click();
  await expect(top).toContainText("모코코 씨앗");
  await expect(top).toContainText("1,569 / 1,569");

  await page.getByRole("group", { name: "단위" }).getByRole("button", { name: "캐릭터" }).click();
  await expect(page).toHaveURL(/unit=CHARACTER/);
  await expect(table.getByRole("columnheader", { name: "캐릭터", exact: true })).toBeVisible();
  await expect(table).toContainText("상세서포터");

  await tabs.getByRole("tab", { name: "캐릭터" }).click();
  await expect(page).not.toHaveURL(/type=collectibles/);
});
