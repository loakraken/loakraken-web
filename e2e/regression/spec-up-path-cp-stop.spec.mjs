// 회귀(api #1029, 백엔드 11-21): 딜러의 점수 효율 추천 순서는 방어구 재련·팔 보호구 단계도 점수로 고르고, 그 첫 단계부터
// 전투력을 내지 않는다(단계 자세히 보기·시뮬레이터에서 '—'). 순서 아래에 몇 단계부터 전투력을 계산하지 않았는지와 그 까닭을
// 말한다. 점수와 비용은 그대로. 목: '점수순서방어구'는 2단계부터, '점수순서방어구첫'은 첫 단계부터. 같은 딜러의 효율 우선과
// 멈춤이 없는 '점수순서딜러'는 이 문장이 없다. 320·1280 넘침 없음. 문장은 답의 마지막 칸이라 그 안에서 밀 것이 없다.
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const REASON = "방어구·팔 보호구 재련은 전투력 계산식을 아직 확인하고 있어요. 점수와 비용은 그대로 셌어요.";
const FROM_2 = `2단계부터는 전투력을 계산하지 않았어요. ${REASON}`;
const FROM_1 = `이 순서는 첫 단계부터 전투력을 계산하지 않았어요. ${REASON}`;
const ANY = /전투력을 계산하지 않았어요/;
const rule = (page) => page.getByRole("group", { name: "추천 순서 고르는 기준" });
const answer = (page) => page.getByRole("region", { name: "추천 순서", exact: true });
const pathTable = (page) => page.getByRole("table", { name: /^추천 순서, / });

const scored = async (page, name) => {
  await page.goto(characterPath(name, "specup"));
  await rule(page).getByRole("button", { name: "점수 효율" }).click();
  await expect(pathTable(page)).toHaveAccessibleName("추천 순서, 크라켄 점수 기준");
};

for (const width of [320, 1280])
  test(`@A37 ${width} 점수 효율 순서가 전투력을 멈춘 단계와 까닭을 말한다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await scored(page, "점수순서방어구");
    await expect(answer(page).getByText(FROM_2, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    // The same dealer's 효율 우선 order has no stop.
    await rule(page).getByRole("button", { name: "효율 우선" }).click();
    await expect(pathTable(page)).toHaveAccessibleName(/효율 우선/);
    await expect(answer(page).getByText(ANY)).toHaveCount(0);
  });

test("@A37 1280 첫 단계부터 멈춘 순서는 '첫 단계부터'라고 말한다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await scored(page, "점수순서방어구첫");
  await expect(answer(page).getByText(FROM_1, { exact: true })).toBeVisible();
});

test("@A37 1280 전투력이 멈추지 않은 점수 효율 순서에는 이 문장이 없다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await scored(page, "점수순서딜러");
  // The note under the path is there (so the absence below is not of an empty answer).
  await expect(answer(page).getByText(/다시 계산한 값이에요/)).toBeVisible();
  await expect(answer(page).getByText(ANY)).toHaveCount(0);
});
