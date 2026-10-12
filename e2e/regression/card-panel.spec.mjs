// 회귀: 전투 탭 "카드" 패널이 오류 없이 그려진다(카드 이름·각성 점·세트 효과).
// 백엔드 OpenAPI 카드 스키마 이름 충돌 수정(backend #102) 뒤 프론트 생성 타입이 바뀔 수 있어
// 감시한다(PM-프론트 요청 2026-10-08). 값이 아니라 구조만 본다.
// '목캐릭터A'는 목 서버의 기본 합성 표본(tests/fixtures/character-full-data.json)을 받는다.
import { test, expect, characterPath, CONTRACT_FAILURE } from "../support/fixtures.mjs";

// 장착 카드 목록과 세트 효과 목록은 패널의 직계 목록이다.
// 원정대 카드 기록(web #85부터 카드 패널 안 section)은 따로 본다.
const equipped = (panel) => panel.locator(":scope > ul").first();
const setEffects = (panel) => panel.locator(":scope > ul").nth(1);

for (const name of ["목캐릭터A", "상세", "상세서포터"]) {
  test(`'${name}' 카드 패널이 그려진다 @regression`, async ({ page }) => {
    await page.goto(characterPath(name));
    await expect(page.getByText(CONTRACT_FAILURE)).toHaveCount(0);
    const panel = page.getByRole("region", { name: "카드", exact: true });
    await expect(panel.getByRole("heading", { name: "카드", exact: true })).toBeVisible();
    await expect(panel).toContainText(/각성 합 \d+/);
    const cards = equipped(panel).locator("figure");
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      await expect(card.locator("figcaption strong")).not.toBeEmpty();
      await expect(card.getByRole("img", { name: /^(\d+각성|각성 미확인)$/ })).toBeVisible();
    }
    // 세트 효과: 이름과 설명이 원문 마크업 없이 보인다.
    expect(await setEffects(panel).locator("li").count()).toBeGreaterThan(0);
    await expect(panel).not.toContainText("<FONT");
  });
}

// 원정대 카드 기록(web #61, F-6 → #85에서 카드 패널 안으로 이동): 역할별 6속성 기록, 도감·세트 접기.
// 목 표본: 목캐릭터A → 딜러, 상세서포터 → 서포터, 기록없음 → 빈 기록.
const ROSTER = [
  ["목캐릭터A", "딜러"],
  ["상세서포터", "서포터"],
  ["기록없음", "딜러"],
];
for (const [name, role] of ROSTER) {
  test(`'${name}' 원정대 카드 기록이 카드 패널 안에 그려진다 @regression`, async ({ page }) => {
    await page.goto(characterPath(name));
    const panel = page.getByRole("region", { name: "카드", exact: true });
    const record = panel.getByRole("region", { name: "원정대 카드 기록" });
    await expect(record.getByRole("heading", { name: "원정대 카드 기록" })).toBeVisible();
    await expect(record.getByText("카드 기록을 불러오지 못했어요.")).toHaveCount(0);
    const roles = record.getByRole("group", { name: "세트 종류" });
    await expect(roles.getByRole("button", { name: role, exact: true })).toHaveAttribute("aria-pressed", "true");
    // 6속성 칸은 각각 "n각성" 또는 "미기록"을 보인다(접근 이름 구성은 프론트가 바꿀 예정이라 글자로 본다).
    const slots = record.locator(":scope > ul").first().locator(":scope > li");
    await expect(slots).toHaveCount(6);
    for (const slot of await slots.all()) await expect(slot).toContainText(/\d+각성|미기록/);
    // 다른 역할 세트로 바꿔 볼 수 있다.
    const other = role === "딜러" ? "서포터" : "딜러";
    await roles.getByRole("button", { name: other, exact: true }).click();
    await expect(roles.getByRole("button", { name: other, exact: true })).toHaveAttribute("aria-pressed", "true");
    if (name === "기록없음")
      await expect(record.getByText(/한 번이라도 검색되면 기록돼요/)).toBeVisible();
    else await expect(record.locator("summary", { hasText: "도감" })).toBeVisible();
  });
}
