// 회귀: 전투 탭 "카드" 패널이 오류 없이 그려진다(카드 이름·각성 점·세트 효과).
// 백엔드 OpenAPI 카드 스키마 이름 충돌 수정(backend #102) 뒤 프론트 생성 타입이 바뀔 수 있어
// 감시한다(PM-프론트 요청 2026-10-08). 값이 아니라 구조만 본다.
// '언새늘'은 목 서버의 기본 합성 표본(tests/fixtures/character-full-data.json)을 받는다.
import { test, expect, characterPath, CONTRACT_FAILURE } from "../support/fixtures.mjs";

for (const name of ["언새늘", "상세", "상세서포터"]) {
  test(`'${name}' 카드 패널이 그려진다 @regression`, async ({ page }) => {
    await page.goto(characterPath(name));
    await expect(page.getByText(CONTRACT_FAILURE)).toHaveCount(0);
    const panel = page.getByRole("region", { name: "카드", exact: true });
    await expect(panel.getByRole("heading", { name: "카드", exact: true })).toBeVisible();
    await expect(panel).toContainText(/각성 합 \d+/);
    const cards = panel.locator("figure");
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      await expect(card.locator("figcaption strong")).not.toBeEmpty();
      await expect(card.getByRole("img", { name: /^(\d+각성|각성 미확인)$/ })).toBeVisible();
    }
    // 세트 효과: 이름과 설명이 원문 마크업 없이 보인다.
    const sets = panel.locator("ul").last().locator("li");
    expect(await sets.count()).toBeGreaterThan(0);
    await expect(panel).not.toContainText("<FONT");
  });
}
