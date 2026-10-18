// 회귀(풀스택 PM 실데이터 확인, P1): 세팅 점검 탭에 내부 키가 영어로 보였다('observed-v3', 'equipment
// 데이터 제공 · engravings …'). 원천 이름은 한국어(장비·각인·보석·카드·아크 패시브·아크 그리드·원정대·스킬·
// 아바타·내실), 규칙 버전은 화면에 없고, '데이터 미제공'과 '조회 안 함'의 차이를 한 줄로 알린다.
import { test, expect, gotoReady, characterPath } from "../support/fixtures.mjs";

for (const width of [1280, 360])
  test(`@세팅점검 ${width} 원천 이름은 한국어, 내부 키·규칙 버전 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세", "evidence"));
    const source = page.getByRole("heading", { name: "원천 제공 상태" }).locator("xpath=ancestor::section[1]");
    await expect(source).toBeVisible();
    for (const name of ["장비", "각인", "보석", "카드", "아크 패시브", "아크 그리드"])
      await expect(source.getByRole("listitem").filter({ has: page.locator("strong", { hasText: new RegExp(`^${name}$`) }) })).toHaveCount(1);
    for (const key of ["equipment", "engravings", "arkPassive", "arkGrid", "siblings", "collectibles"])
      await expect(source, `내부 키 '${key}'`).not.toContainText(key);
    await expect(page.getByRole("region", { name: "세팅 점검 결과" }), "규칙 버전").not.toContainText("observed-v");
    await expect(source).toContainText("데이터 미제공은 전투정보실이 그 정보를 주지 않은 것이고, 조회 안 함은");
  });
