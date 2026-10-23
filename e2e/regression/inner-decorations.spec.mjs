// 회귀(사용자 제보 v0.3.2): 내실 탭 특수 장비의 '문장' 줄이 공식 응답의 이미지 주소를 글자 그대로
// 보였다. 주소는 작은 그림(문장 1·문장 2·심볼, 24px 고정)으로 그리고, 주소 글자는 화면에 없다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

for (const width of [1280, 360])
  test(`@문장 ${width}: 문장·심볼은 그림으로, 주소 글자 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세", "collectibles"));
    const row = page.getByRole("listitem").filter({ has: page.getByText("문장", { exact: true }) });
    await expect(row).toHaveCount(1);
    for (const name of ["문장 1", "문장 2", "심볼"]) {
      const picture = row.getByRole("img", { name, exact: true });
      await expect(picture).toBeVisible();
      expect(await picture.evaluate((img) => [img.width, img.height])).toEqual([24, 24]);
    }
    await expect(row).not.toContainText("https://");
    await expect(row).not.toContainText(".png");
  });
