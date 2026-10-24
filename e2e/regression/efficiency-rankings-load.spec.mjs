// 회귀: 팔찌·젬 효율 랭킹이 처음 그려질 때 움직이지 않는다 — 답이 0줄·3줄·50줄 어느 쪽이어도
// 표 아래 안내가 위로 당겨 올라오지 않는다(A7). 표본을 모으는 중이면 위 안내에 그렇게 적고,
// 효율의 뜻은 답의 ruleVersion을 따른다(실 효율 = 캐릭터 화면 값, 그 밖 = 전투력 기준).
// 목: 직업 환수사 = 0줄, 리퍼 = 실 효율 규칙의 3줄(표본 모으는 중), 그 밖 = 예전 규칙 50줄.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const CASES = [
  { rows: 0, query: "&className=%ED%99%98%EC%88%98%EC%82%AC", collecting: true },
  { rows: 3, query: "&className=%EB%A6%AC%ED%8D%BC", collecting: true },
  { rows: 50, query: "", collecting: false },
];

for (const type of ["bracelets", "gems"])
  for (const { rows, query, collecting } of CASES)
    for (const width of [320, 360, 390, 1280])
      test(`@효율랭킹 ${type} ${rows}줄 ${width}: 첫 그림 흔들림 0 @regression`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await watchShifts(page);
        await gotoReady(page, `/rankings?type=${type}${query}`);
        if (rows === 0) await expect(page.getByText("조건에 맞는 캐릭터가 없어요.")).toBeVisible();
        else await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(rows);
        const notice = page.getByText(/^공식 랭킹이 아니에요/);
        if (collecting) await expect(notice).toContainText("아직 표본을 모으고 있어요");
        else await expect(notice).not.toContainText("표본을 모으고");
        await page.waitForTimeout(600);
        const { all, moved } = await shiftsSince(page);
        expect(all, `첫 그림 흔들림 (${moved})`).toBe(0);
      });

for (const [type, real, old] of [
  ["bracelets", "캐릭터 화면의 팔찌 효율과 같은 값이에요.", "팔찌를 뺀 전투력과 비교했어요."],
  ["gems", "캐릭터 화면의 아크 그리드 효율과 같은 값이에요.", "젬 옵션을 뺀 전투력과 비교했어요."],
]) {
  test(`@효율랭킹 ${type}: 실 효율 규칙이면 캐릭터 화면과 같은 값이라고 설명 @regression`, async ({ page }) => {
    await gotoReady(page, `/rankings?type=${type}${CASES[1].query}`);
    await expect(page.getByText(real)).toBeVisible();
    await expect(page.getByText(old)).toHaveCount(0);
  });
  test(`@효율랭킹 ${type}: 예전 규칙이면 전투력 기준 설명 @regression`, async ({ page }) => {
    await gotoReady(page, `/rankings?type=${type}`);
    await expect(page.getByText(old)).toBeVisible();
    await expect(page.getByText(real)).toHaveCount(0);
  });
}
