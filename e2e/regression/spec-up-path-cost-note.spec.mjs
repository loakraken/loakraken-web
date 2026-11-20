// 회귀(PM 총괄 11-20 P1, QA; PM-프론트 #1793 P3): 추천 순서 아래 비용 설명은 순서마다 api가 비용을 센 방식대로 말한다
// (api #993 spec-up-path-v6: paidCost·marginal). 효율 우선·점수 효율: 거래할 수 있는 보석·장신구는 앞 단계 값을 빼고, 귀속
// 보석·빈 칸 보석·거래할 수 없는 장신구·어빌리티 스톤은 단계마다 새 값을 다 셈. 전투력 우선: 보석·어빌리티 스톤(연마 단계가
// 있으면 장신구도)은 같은 칸의 앞 단계 비용을 뺌. 다른 규칙 버전(v6 전)의 답은 센 방식을 말하지 않음. 320·1280에서 넘침
// 없음, 320 첫 로드 흔들림 0.
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const PLAIN = "비용은 그 단계에서 더 드는 골드예요.";
const PER_STEP = `${PLAIN} 거래할 수 있는 보석·장신구는 같은 칸의 앞 단계 값을 빼고, 귀속 보석·빈 칸 보석·거래할 수 없는 장신구·어빌리티 스톤은 단계마다 새 값을 다 셌어요.`;
const DELTA = "비용은 그 단계에서 더 드는 골드이고, 보석·어빌리티 스톤은 같은 칸의 앞 단계 비용을 빼고 셌어요.";
const DELTA_POLISH = "비용은 그 단계에서 더 드는 골드이고, 보석·어빌리티 스톤·장신구는 같은 칸의 앞 단계 비용을 빼고 셌어요.";
// Words only a per-step claim has (either order's sentence).
const CLAIM = /앞 단계 (값|비용)을 빼고/;
const rule = (page) => page.getByRole("group", { name: "추천 순서 고르는 기준" });
const answer = (page) => page.getByRole("region", { name: "추천 순서", exact: true });
const pathTable = (page) => page.getByRole("table", { name: /^추천 순서, / });

for (const width of [320, 1280])
  test(`@A37 ${width} 추천 순서 비용 설명: 효율 우선은 단계마다 센 방식, 전투력 우선은 앞 단계를 뺀 방식 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(characterPath("스펙순서", "specup"));
    await expect(pathTable(page)).toBeVisible();
    await expect(answer(page).getByText(PER_STEP, { exact: false })).toBeVisible();
    await expect(answer(page).getByText(DELTA, { exact: false })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await rule(page).getByRole("button", { name: "전투력 우선" }).click();
    await expect(pathTable(page)).toHaveAccessibleName(/전투력 우선/);
    await expect(answer(page).getByText(DELTA, { exact: false })).toBeVisible();
    await expect(answer(page).getByText(PER_STEP, { exact: false })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

test("@A37 320 추천 순서 비용 설명: 연마 단계가 있는 전투력 우선은 장신구도 말한다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(characterPath("스펙순서연마", "specup"));
  await rule(page).getByRole("button", { name: "전투력 우선" }).click();
  await expect(pathTable(page)).toHaveAccessibleName(/전투력 우선/);
  await expect(answer(page).getByText(DELTA_POLISH, { exact: false })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("@A37 1280 추천 순서 비용 설명: 점수 효율도 단계마다 센 방식 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(characterPath("점수순서딜러", "specup"));
  await rule(page).getByRole("button", { name: "점수 효율" }).click();
  await expect(pathTable(page)).toHaveAccessibleName("추천 순서, 크라켄 점수 기준");
  await expect(answer(page).getByText(PER_STEP, { exact: false })).toBeVisible();
});

test("@A37 1280 추천 순서 비용 설명: v6 전 규칙의 답은 센 방식을 말하지 않는다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(characterPath("스펙순서비용모름옛", "specup"));
  await expect(pathTable(page)).toBeVisible();
  await expect(answer(page).getByText(PLAIN, { exact: false })).toBeVisible();
  await expect(answer(page).getByText(CLAIM)).toHaveCount(0);
});

test("@A7 320 추천 순서 첫 로드 흔들림 0(비용 설명) @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await watchShifts(page);
  await page.goto(characterPath("스펙순서", "specup"));
  await expect(answer(page).getByText(PER_STEP, { exact: false })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const loaded = await shiftsSince(page);
  expect(loaded.all, `첫 로드 흔들림 (${loaded.moved})`).toBe(0);
});
