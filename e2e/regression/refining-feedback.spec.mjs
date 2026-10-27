// 회귀(사용자 제보 10-26, #1116·#1117·#1118): 재련 기대 비용
// - 가격 기준(현재 최저가 / 최근 거래가 / 전일 평균가)을 바꿔도 '필요 재료' 표와 열 폭이 그대로(흔들림 0)
// - 휴대폰은 카드 모양에서 잘리는 칸 없음
// - 카드 머리 앞 1·2·3 번호 없음(재료 구매 견적도)
// - '사야 할 골드'·'쓰는 재료 시세' 이름과 한 줄 뜻, 예전 이름('구매 골드'·'소모 가치')은 없음
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const BASES = ["최근 거래가", "전일 평균가", "현재 최저가"];

/**
 * The mock prices every basis the same. Real bases differ, often by digits:
 * the other two bases answer with prices ×731 so the numbers get longer.
 */
async function pricesByBasis(page) {
  await page.route("**/api/markets/material-prices", async (route) => {
    const basis = route.request().postDataJSON()?.priceBasis;
    const response = await route.fetch();
    const body = await response.json();
    const envelope = body.envelope ?? body;
    if (basis && basis !== "CURRENT_MIN_PRICE")
      for (const item of envelope.data.items)
        for (const key of ["unitPriceGold", "bundlePrice"]) if (item[key] != null) item[key] = item[key] * 731;
    await route.fulfill({ response, json: body });
  });
}

async function openPlan(page) {
  await page.goto("/tools/refining");
  await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
  await expect(page.getByText(/^시세 \d{2}:\d{2} 기준 · 1분마다 새로 불러와요$/)).toBeVisible();
}

const materials = (page) => page.locator("table[data-wide]");

/** Table width and each column's width (header cells), rounded to 0.5 px. */
const widths = (page) =>
  materials(page).evaluate((table) =>
    [table, ...table.querySelectorAll("thead th")].map((el) => Math.round(el.getBoundingClientRect().width * 2) / 2),
  );

async function pickBasis(page, label) {
  // A basis seen before comes from the cache (no request): wait for the table, not the network.
  await page.getByRole("radiogroup", { name: "재료 가격 기준" }).getByRole("radio", { name: label }).click();
  await expect(page.getByRole("radio", { name: label })).toBeChecked();
  await page.waitForTimeout(300);
  await expect(page.locator('[aria-busy="true"]').filter({ has: materials(page) })).toHaveCount(0);
  // Let the new numbers land and the change marks run.
  await page.waitForTimeout(800);
}

test.describe("재련 기대 비용 사용자 제보 @regression", () => {
  for (const width of [768, 1024, 1280])
    test(`${width}: 가격 기준을 바꿔도 재료 표와 열 폭이 그대로이고 흔들림이 없다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await pricesByBasis(page);
      await watchShifts(page);
      await openPlan(page);
      const before = await widths(page);
      const mark = await shiftMark(page);
      for (const label of BASES) {
        await pickBasis(page, label);
        expect(await widths(page), `${label}: 표·열 폭`).toEqual(before);
      }
      // Boxes only: a longer number (×731 here) moves its own right-aligned text
      // inside a cell of the same width; a moved row, cell or line is a shift.
      const boxes = await page.evaluate(
        (from) =>
          window.__shiftLog
            .filter((entry) => entry.t >= from && entry.sources.some((source) => !source.endsWith("#text")))
            .flatMap((entry) => entry.sources),
        mark,
      );
      expect(boxes, `가격 기준 전환 흔들림(${(await shiftsSince(page, mark)).moved})`).toEqual([]);
      await expectNoHorizontalOverflow(page);
    });

  test("360: 카드 모양에서 가격 기준을 바꿔도 잘리는 칸이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await pricesByBasis(page);
    await openPlan(page);
    for (const label of BASES) {
      await pickBasis(page, label);
      await expectNoHorizontalOverflow(page);
      const cut = await materials(page).evaluate((table) =>
        [...table.querySelectorAll("tbody th, tbody td")]
          // Cut = clipped: the ▲/▼ change mark may stick out of a cell that shows it whole.
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible")
          .map((el) => el.textContent.trim().slice(0, 20)),
      );
      expect(cut, `${label}: 잘린 칸`).toEqual([]);
    }
  });

  test("카드 머리 앞에 1·2·3 번호가 없고, 두 금액은 새 이름과 한 줄 뜻으로 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPlan(page);
    for (const id of ["load-heading", "target-heading", "option-heading"]) {
      const card = page.locator(`section[aria-labelledby="${id}"]`);
      await expect(card.locator(":scope > p").filter({ hasText: /^\s*[1-3]\s*$/ })).toHaveCount(0);
    }
    const table = materials(page);
    await expect(table.getByRole("columnheader", { name: "사야 할 골드" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "쓰는 재료 시세" })).toBeVisible();
    await expect(page.getByText("구매 골드", { exact: true })).toHaveCount(0);
    await expect(page.getByText("소모 가치", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/소모 가치/)).toHaveCount(0);
    await expect(page.getByText("가진 수량을 빼고 부족한 만큼만 지금 살 때 드는 골드예요.")).toBeVisible();
    await expect(page.getByText("가진 재료까지 포함해 재련에 쓰일 재료 전체를 시세로 친 값이에요.")).toBeVisible();
    // The longer notes are folded under '자세히'.
    const more = page.locator("details").filter({ has: page.getByText("자세히", { exact: true }) });
    await expect(more).not.toHaveAttribute("open", "");
    await expect(page.getByText(/가진 재료까지 시세로 치면/)).toBeVisible();
  });

  test("재료 구매 견적에도 1·2·3 번호가 없다", async ({ page }) => {
    await page.goto("/market/quote");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main section > p").filter({ hasText: /^\s*[1-3]\s*$/ })).toHaveCount(0);
  });
});
