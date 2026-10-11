// 회귀: 내실 탭에 수집품 순위 카드(백엔드 #304)와 항목별 보유율·희귀한 순(#306)이 나온다.
// 표본 기반 수치는 '크라켄 표본 원정대 N개 기준'을 함께 적는다(PM 15:04).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("내실 탭: 수집품 순위와 항목 보유율·희귀한 순 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "collectibles"));
  const standing = page.getByRole("region", { name: "수집품 순위" });
  await expect(standing).toContainText("213,572위");
  await expect(standing).toContainText("667,840개");
  await expect(standing).toContainText("32%");
  await expect(standing).toContainText("크라켄 표본 원정대 667,840개 기준");

  const list = page.locator("[aria-label$='목록'] ol").first();
  await expect(list).toContainText("보유율");
  await page.getByRole("button", { name: "희귀한 순" }).click();
  const shares = await list.locator("em").allInnerTexts();
  const values = shares.map((text) => Number(text.match(/([\d.]+)%/)[1]));
  expect(values).toEqual([...values].sort((a, b) => a - b));
});
