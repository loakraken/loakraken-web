// 오픈 소스·출처(/credits): 바닥글에서 들어가고, 가져와 고친 화면 부품은 원본 컴포넌트 페이지로 가는 링크가 보인다
// (21st.dev 약관 §3). 라이브러리·글꼴·아이콘은 라이선스와 함께. 320·1280에서 가로 넘침 없음.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

for (const width of [320, 1280])
  test(`오픈 소스·출처 ${width}: 바닥글에서 들어가고 원본 링크가 보임 @smoke`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "오픈 소스·출처" }).click();
    await expect(page).toHaveURL(/\/credits$/);
    await expect(page.getByRole("heading", { level: 1, name: "오픈 소스·출처" })).toBeVisible();
    const adapted = page.getByRole("table", { name: "가져와 고친 화면 부품" });
    const originals = adapted.getByRole("link", { name: /21st\.dev 원본 컴포넌트/ });
    await expect(originals).toHaveCount(2);
    for (const link of await originals.all()) {
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", /^https:\/\/21st\.dev\/@rmahammad\/components\//);
    }
    await expect(page.getByRole("table", { name: "라이브러리" })).toContainText("Apache-2.0");
    await expect(page.getByRole("table", { name: "아이콘·글꼴" })).toContainText("SIL Open Font License 1.1");
    await expect(page.getByRole("link", { name: /로스트아크 공식 Open API/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
