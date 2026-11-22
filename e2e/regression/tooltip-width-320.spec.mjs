// 회귀(#1941): 공용 말풍선은 320 화면에서도 화면 폭 − 여백(16px)보다 넓어지지 않는다. 예전 max-w-xs(20rem = 320px)는 화면
// 폭과 같아, 긴 글의 말풍선이 오른쪽으로 5px 넘었다(web #1940 측정). 1280에서는 예전과 같은 20rem.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const maxWidthOfOpenTooltip = async (page) => {
  const term = page.getByRole("button", { name: /^아크 그리드 효율/ });
  await term.focus();
  const popup = page.locator("[data-slot=tooltip-content]");
  await expect(popup).toBeVisible();
  return popup.evaluate((el) => parseFloat(getComputedStyle(el).maxWidth));
};

test("320: 말풍선의 최대 폭은 화면 폭 − 16px @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoReady(page, characterPath("상세"));
  expect(await maxWidthOfOpenTooltip(page)).toBeLessThanOrEqual(320 - 16);
});

test("1280: 말풍선의 최대 폭은 그대로 20rem @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, characterPath("상세"));
  const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(await maxWidthOfOpenTooltip(page)).toBe(20 * rem);
});
