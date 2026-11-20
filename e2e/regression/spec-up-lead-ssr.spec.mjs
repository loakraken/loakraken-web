// 회귀(#1858 · #1862, PM 총괄 11-21 성능 점검): 스펙업 탭의 첫 안내 문장은 탭 틀이 그려 서버 HTML에 들어 있다. 전에는 늦게
// 불러오는 가이드 안에 있어 첫 JS · 가이드 코드 · 첫 목록 답 뒤에야 그려졌고, 느린 휴대폰(Slow 4G · CPU 4배)에서 이
// 문장이 LCP라 5초 가까이 걸렸다.
// - 딜러: 서버 HTML에 문장이 있다. 첫 답을 붙잡아 둔 동안 · 놓은 뒤 모두 문장은 한 번, 정렬 칩 위, 흔들림 0(탐색 시작부터).
// - 역할 모름(서포터 직업, 깨달음으로 못 정함): 웹은 딜러 목록(전투력 증가 순, 전투력)을 묻고 보여 주므로 딜러 문장이
//   화면과 맞다(PM-프론트 11-21 #1862 결정). 서버 HTML에 딜러 문장, 그리고 딜러 순서 목록.
// - 서포터: 문장은 첫 답이 정한다(추천 순서가 도는지) — 그래서 서버 HTML에는 없고(의도), 답 뒤 서포터 문장 한 번 · 표 위.
import { test, expect, specUpListPath } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const DEALER_LEAD = /바꿨을 때 오르는 전투력과 드는 골드를 함께 보고, 처음에는/;
const SUPPORTER_LEADS = [
  "바꿨을 때 오르는 서포터 점수와 드는 골드를 함께 보고, 처음에는 올리는 차례대로 고른 추천 순서를 보여 드려요. 아래에서 다른 정렬로 바꿀 수 있어요.",
  "바꿨을 때 오르는 서포터 점수와 드는 골드를 함께 보고, 10만 골드당 점수가 높은 순서로 보여 드려요.",
];
const serverHtml = async (page, baseURL, name) => {
  const response = await page.request.get(new URL(specUpListPath(name), baseURL).toString());
  expect(response.status()).toBe(200);
  return response.text();
};

test("서버 HTML: 딜러 · 역할 모름은 딜러 문장, 서포터는 문장 없음(첫 답 뒤) @regression", async ({ page, baseURL }) => {
  const dealer = await serverHtml(page, baseURL, "실목록2");
  expect(dealer).toMatch(DEALER_LEAD);
  expect(dealer).toContain("스펙업 가이드를 준비하고 있어요…");
  const unknown = await serverHtml(page, baseURL, "역할모름바드");
  expect(unknown).toMatch(DEALER_LEAD);
  const supporter = await serverHtml(page, baseURL, "상세서포터");
  expect(supporter).toContain("스펙업 가이드를 준비하고 있어요…");
  expect(supporter).not.toContain("바꿨을 때 오르는");
});

for (const width of [320, 1280]) {
  test(`${width}: 딜러 — 첫 답을 기다리는 동안 · 받은 뒤 문장은 한 번, 정렬 칩 위, 탐색 시작부터 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await watchShifts(page);
    let release;
    const gate = new Promise((r) => (release = r));
    await page.route(/\/api\/characters\/spec-up\?/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto(specUpListPath("실목록2"));
    const lead = page.getByText(DEALER_LEAD);
    await expect(lead).toHaveCount(1);
    await expect(page.getByText("스펙업 가이드를 준비하고 있어요…")).toBeVisible();
    release();
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    await table.locator("tbody tr").first().waitFor();
    await expect(lead).toHaveCount(1);
    const chips = page.getByRole("button", { name: "전투력 증가", exact: true }).first();
    const [leadBox, chipBox] = [await lead.boundingBox(), await chips.boundingBox()];
    expect(leadBox.y + leadBox.height).toBeLessThanOrEqual(chipBox.y);
    await page.waitForTimeout(500);
    const { all, moved } = await shiftsSince(page, 0);
    expect(all, `흔들림 (${moved})`).toBe(0);
  });

  test(`${width}: 서포터 — 첫 답 뒤 서포터 문장(글자 그대로) 한 번, 표 위 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(specUpListPath("상세서포터"));
    const lead = page.getByText(/^바꿨을 때 오르는 서포터 점수와 드는 골드를 함께 보고/);
    await expect(lead).toHaveCount(1);
    expect(SUPPORTER_LEADS).toContain((await lead.textContent()).trim());
    await expect(page.getByText(DEALER_LEAD)).toHaveCount(0);
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    await table.locator("tbody tr").first().waitFor();
    const [leadBox, tableBox] = [await lead.boundingBox(), await table.boundingBox()];
    expect(leadBox.y + leadBox.height).toBeLessThanOrEqual(tableBox.y);
  });

  test(`${width}: 역할 모름 — 딜러 문장 한 번과 딜러 순서 목록(전투력 증가 순, 전투력 칸) @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(specUpListPath("역할모름바드"));
    await expect(page.getByText(DEALER_LEAD)).toHaveCount(1);
    await expect(page.getByText(/서포터 점수와 드는 골드/)).toHaveCount(0);
    const table = page.getByRole("table", { name: /전투력 증가 순/ });
    await table.locator("tbody tr").first().waitFor();
    await expect(table.locator("thead th").filter({ hasText: /^전투력 증가$/ })).toHaveCount(1);
    await expect(table.locator("thead th").filter({ hasText: /서포터 점수/ })).toHaveCount(0);
  });
}
