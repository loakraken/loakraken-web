// 회귀: 원정대 탭 도구(체크리스트 L17·L18) — 정렬 3종·축약·닉네임 가리기, 식스맨 평균 줄.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("원정대 탭: 식스맨 평균, 정렬·축약·닉네임 가리기 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "siblings"));
  await expect(page.getByText(/식스맨 평균 [\d,.]+/)).toBeVisible();
  await expect(page.getByText(/1,680 이상 \d+명/)).toBeVisible();

  const names = () => page.locator("ul[class*=siblingGrid]").first().locator("strong").allInnerTexts();
  const byLevel = await names();
  await page.getByRole("radiogroup", { name: "원정대 정렬" }).getByRole("radio", { name: "이름 순" }).click();
  const byName = await names();
  expect(byName).toEqual([...byLevel].sort((a, b) => a.localeCompare(b, "ko")));

  await page.getByRole("switch", { name: "축약" }).click();
  await expect(page.locator("ul[class*=siblingGrid][data-compact]").first()).toBeVisible();
  await expect(page.locator("ul[class*=siblingGrid] small").first()).toBeHidden();

  await page.getByRole("switch", { name: "닉네임 가리기" }).click();
  const masked = await names();
  expect(masked.every((name) => /^.\*\*$/u.test(name))).toBe(true);
  for (const name of byName) await expect(page.locator("ul[class*=siblingGrid]").getByText(name, { exact: true })).toHaveCount(0);
});
