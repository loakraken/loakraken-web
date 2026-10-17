// 회귀(K35 분 단위 차트): 시세 추이 '1시간' — 최근 1시간 판매 최저가를 시간 축 그대로(확인하지 않은
// 분은 비움), 얼마마다 확인하는지 한 줄로. 7일·14일과 오가도 흔들림 0, 분 단위로 확인하지 않는 품목은 안내.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360])
  test(`@K35 ${width} 1시간 그래프와 확인 주기, 기간 전환 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market");
    const detail = page.getByRole("region", { name: "아비도스 융화 재료 시세" });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("하루 평균 거래가와 거래량")).toBeVisible();
    const range = detail.getByRole("group", { name: "기간" });
    const hour = await shiftsDuring(page, () => range.getByRole("button", { name: "1시간" }).click(), 1500);
    await expect(detail.getByRole("img", { name: /^최근 1시간 판매 최저가/ })).toBeVisible();
    await expect(detail.getByText("판매 최저가 · 약 30초마다 확인 · 확인하지 않은 분은 비어 있어요")).toBeVisible();
    expect(hour.all, `1시간 전환 흔들림 (${hour.moved})`).toBe(0);
    const back = await shiftsDuring(page, () => range.getByRole("button", { name: "7일" }).click(), 1500);
    await expect(detail.getByRole("img", { name: /^일 평균 거래가와 거래량/ })).toBeVisible();
    expect(back.all, `7일 전환 흔들림 (${back.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

test("@K35 10분마다 확인하는 품목은 그 주기를, 확인하지 않는 품목은 안내 @regression", async ({ page }) => {
  await gotoReady(page, "/market");
  const board = page.getByRole("region", { name: /재련 재료 시세/ });
  await board.getByRole("button", { name: /^운명의 파괴석 / }).first().click();
  const detail = page.getByRole("region", { name: "운명의 파괴석 시세" });
  await detail.getByRole("group", { name: "기간" }).getByRole("button", { name: "1시간" }).click();
  await expect(detail.getByText(/약 10분마다 확인/)).toBeVisible();

  await page.getByRole("tab", { name: "각인서" }).click();
  await page.getByRole("region", { name: /각인서 시세/ }).getByRole("listitem").first().getByRole("button").click();
  const other = page.getByRole("region", { name: /시세$/ }).last();
  await other.getByRole("group", { name: "기간" }).getByRole("button", { name: "1시간" }).click();
  await expect(other.getByText("이 품목은 분 단위로 확인하지 않아요. 7일·14일 추이를 봐 주세요.")).toBeVisible();
});
