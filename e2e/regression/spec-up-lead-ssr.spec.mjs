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

/**
 * Opens the 스펙업 tab with the first list answer held: `whileHeld` runs with only the server HTML and the tab's frame on
 * screen, then the answer goes and `afterAnswer` runs once the list is drawn. Returns the shifts since navigation start.
 */
async function heldLoad(page, width, name, { whileHeld, afterAnswer }) {
  await page.setViewportSize({ width, height: 1000 });
  await watchShifts(page);
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route(/\/api\/characters\/spec-up\?/, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(specUpListPath(name));
  await expect(page.getByText("스펙업 가이드를 준비하고 있어요…")).toBeVisible();
  await whileHeld();
  release();
  const table = page.getByRole("table", { name: /스펙업 후보/ });
  await table.locator("tbody tr").first().waitFor();
  await afterAnswer(table);
  await page.waitForTimeout(500);
  return shiftsSince(page, 0);
}

const above = async (upper, lower) => {
  const [a, b] = [await upper.boundingBox(), await lower.boundingBox()];
  expect(a.y + a.height).toBeLessThanOrEqual(b.y);
};

for (const width of [320, 1280]) {
  test(`${width}: 딜러 — 첫 답을 기다리는 동안 · 받은 뒤 문장은 한 번, 정렬 칩 위, 탐색 시작부터 흔들림 0 @regression`, async ({ page }) => {
    const lead = page.getByText(DEALER_LEAD);
    const { all, moved } = await heldLoad(page, width, "실목록2", {
      whileHeld: () => expect(lead).toHaveCount(1),
      afterAnswer: async () => {
        await expect(lead).toHaveCount(1);
        await above(lead, page.getByRole("button", { name: "전투력 증가", exact: true }).first());
      },
    });
    expect(all, `흔들림 (${moved})`).toBe(0);
  });

  // Each supporter mock's own sentence: 상세서포터's answer has no 추천 순서 by score (supportOrderAvailable absent),
  // 점수순서서폿's has it (true), with SPEC_UP_PATH on in e2e.
  for (const [name, sentence] of [
    ["상세서포터", SUPPORTER_LEADS[1]],
    ["점수순서서폿", SUPPORTER_LEADS[0]],
  ])
    test(`${width}: 서포터 ${name} — 기다리는 동안 문장 없음, 답 뒤 그 문장 그대로 한 번 · 표 위, 탐색 시작부터 흔들림 0 @regression`, async ({ page }) => {
      const lead = page.getByText(sentence, { exact: true });
      const { all, moved } = await heldLoad(page, width, name, {
        whileHeld: async () => {
          await expect(page.getByText(/바꿨을 때 오르는/)).toHaveCount(0);
        },
        afterAnswer: async (table) => {
          await expect(lead).toHaveCount(1);
          await expect(page.getByText(/바꿨을 때 오르는/)).toHaveCount(1);
          await above(lead, table);
        },
      });
      expect(all, `흔들림 (${moved})`).toBe(0);
    });

  test(`${width}: 역할 모름 — 기다리는 동안 · 받은 뒤 딜러 문장 한 번, 딜러 순서 목록, 탐색 시작부터 흔들림 0 @regression`, async ({ page }) => {
    const lead = page.getByText(DEALER_LEAD);
    const { all, moved } = await heldLoad(page, width, "역할모름바드", {
      whileHeld: () => expect(lead).toHaveCount(1),
      afterAnswer: async (table) => {
        await expect(lead).toHaveCount(1);
        await expect(page.getByText(/서포터 점수와 드는 골드/)).toHaveCount(0);
        await expect(page.getByRole("table", { name: /전투력 증가 순/ })).toBeVisible();
        await expect(table.locator("thead th").filter({ hasText: /^전투력 증가$/ })).toHaveCount(1);
        await expect(table.locator("thead th").filter({ hasText: /서포터 점수/ })).toHaveCount(0);
        await above(lead, table);
      },
    });
    expect(all, `흔들림 (${moved})`).toBe(0);
  });
}
