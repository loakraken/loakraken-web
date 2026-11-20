// 회귀(#1858, PM 총괄 11-21 성능 점검): 스펙업 탭의 첫 안내 문장은 탭 틀이 그려 서버 HTML에 들어 있다. 전에는 늦게
// 불러오는 가이드 안에 있어 첫 JS · 가이드 코드 · 첫 목록 답 뒤에야 그려졌고, 느린 휴대폰(Slow 4G · CPU 4배)에서 이
// 문장이 LCP라 5초 가까이 걸렸다.
// - 딜러: 서버 HTML에 문장이 있다. 가이드가 뜬 뒤에도 문장은 한 번, 정렬 칩 위, 흔들림 0.
// - 서포터: 문장은 첫 답이 정한다(추천 순서가 도는지) — 답이 온 뒤 한 번.
import { test, expect, specUpListPath } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const DEALER_LEAD = /바꿨을 때 오르는 전투력과 드는 골드를 함께 보고, 처음에는/;

test("서버 HTML에 딜러의 첫 안내 문장이 있다 @regression", async ({ page, baseURL }) => {
  const response = await page.request.get(new URL(specUpListPath("실목록2"), baseURL).toString());
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toMatch(DEALER_LEAD);
  expect(html).toContain("스펙업 가이드를 준비하고 있어요…");
});

for (const width of [320, 1280]) {
  test(`${width}: 딜러 — 가이드가 뜬 뒤에도 문장은 한 번, 정렬 칩 위, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await watchShifts(page);
    await page.goto(specUpListPath("실목록2"));
    const mark = await shiftMark(page);
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    await table.locator("tbody tr").first().waitFor();
    const lead = page.getByText(DEALER_LEAD);
    await expect(lead).toHaveCount(1);
    const chips = page.getByRole("button", { name: "전투력 증가", exact: true }).first();
    const [leadBox, chipBox] = [await lead.boundingBox(), await chips.boundingBox()];
    expect(leadBox.y + leadBox.height).toBeLessThanOrEqual(chipBox.y);
    await page.waitForTimeout(500);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
  });

  test(`${width}: 서포터 — 첫 답이 온 뒤 서포터 문장이 한 번 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(specUpListPath("상세서포터"));
    await expect(page.getByText(/바꿨을 때 오르는 서포터 점수와 드는 골드를 함께 보고/)).toHaveCount(1);
    await expect(page.getByText(DEALER_LEAD)).toHaveCount(0);
  });
}

