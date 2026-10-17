// 회귀(#857 검토 10-16): 1분 갱신으로 값이 실제로 바뀔 때(두 번째 응답부터 가격 ×1.37, 효율 순서 뒤바뀜)
// — 글자가 길어져도 표·칸이 움직이지 않고(A7), 바뀐 칸이 잠깐 물들고, 보석판은 읽기 프로그램에 "N개 바뀜",
// 스펙업은 줄 순서를 그대로 두고 '새 순서로 보기'를 눌러야 새 순서가 된다(PM 총괄 판정 b).
import { test, expect, gotoReady, characterPath } from "../support/fixtures.mjs";

const watch = (page) =>
  page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (!e.hadRecentInput)
          window.__shifts.push({
            v: e.value,
            src: (e.sources ?? []).map((s) => {
              const el = s.node?.nodeType === 1 ? s.node : s.node?.parentElement;
              const r = (b) => [b.x, b.y, b.width, b.height].map(Math.round).join(",");
              return `${el?.tagName}${el?.dataset?.cell ? `[${el.dataset.cell}]` : ""} ${r(s.previousRect)}→${r(s.currentRect)}`;
            }),
          });
    }).observe({ type: "layout-shift", buffered: true });
  });
const shifts = (page) => page.evaluate(() => window.__shifts.reduce((a, e) => a + e.v, 0));
/** What moved, for the failure message. */
const movedOf = (page) => page.evaluate(() => [...new Set(window.__shifts.flatMap((e) => e.src))].slice(0, 8).join(" | "));
const resetShifts = (page) => page.evaluate(() => (window.__shifts = []));

/** Serves the real mock answer the first time, a changed one after (×1.37 and `edit`). */
async function changing(page, url, edit) {
  let served = 0;
  await page.route(url, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    served += 1;
    // The web's own route wraps the backend answer: { ok, envelope }.
    if (served > 1) edit(body.envelope ?? body);
    await route.fulfill({ response, json: body });
  });
  return () => served;
}
const up = (n) => Math.round(n * 1.37);

for (const width of [1280, 360]) {
  test(`@A7 ${width} 스펙업: 비용이 길어져도 표가 안 움직이고, 바뀐 칸이 물들고, 새 순서는 눌러서 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await watch(page);
    const served = await changing(page, /\/api\/characters\/spec-up\?/, (body) => {
      const list = body.data.candidates;
      for (const c of list) if (c.cost?.amount != null) c.cost.amount = up(c.cost.amount) + 9_400;
      // The backend now ranks them the other way round.
      const effs = list.map((c) => c.combatPowerPer10kGold).filter((v) => v != null).sort((a, b) => b - a);
      body.data.candidates = [...list].reverse();
      let i = 0;
      for (const c of body.data.candidates) if (c.combatPowerPer10kGold != null) c.combatPowerPer10kGold = effs[i++];
    });
    await gotoReady(page, characterPath("전투력계산", "specup"));
    // By its rows: on a phone the table is laid out as cards (no table role).
    const table = page.locator("table").filter({ has: page.locator('[data-cell="target"]') });
    await expect(table.locator("tbody tr")).toHaveCount(3);
    const before = await table.locator('[data-cell="target"]').allTextContents();
    await resetShifts(page);
    await page.clock.runFor(61_000);
    await expect.poll(served, { message: "1분 뒤 다시 받음" }).toBeGreaterThan(1);
    await expect(table).toContainText("85만 8,800G"); // 62만 × 1.37 + 9,400: longer text
    // The changed costs tint once (the wash is cleared only after 1.4 s of page time).
    await expect.poll(() => table.locator(".chg-wash").count(), { message: "바뀐 칸 물들기" }).toBeGreaterThan(0);
    expect(await shifts(page), `갱신 뒤 흔들림(누르지 않음): ${await movedOf(page)}`).toBe(0);
    expect(await table.locator('[data-cell="target"]').allTextContents(), "줄 순서 그대로").toEqual(before);
    // Said that the rows are the old order — one line in its fixed-height line
    // (nothing spills over the table, A37), and in the table's name.
    const reorder = page.getByRole("button", { name: "새 순서로 보기" });
    await expect(reorder).toBeVisible();
    const line = await reorder.evaluate((el) => {
      const p = el.closest("p");
      return { text: p.textContent, fits: p.scrollHeight <= p.clientHeight + 1 && p.scrollWidth <= p.clientWidth + 1 };
    });
    expect(line.text).toContain("시세 갱신 전 순서예요");
    expect(line.fits, `한 줄에 들어감: ${line.text}`).toBe(true);
    await expect(table.locator("caption")).toContainText("(시세 갱신 전 순서)");
    // The new order is one press away.
    await reorder.click();
    await expect.poll(() => table.locator('[data-cell="target"]').allTextContents()).toEqual([...before].reverse());
    await expect(page.getByRole("button", { name: "새 순서로 보기" })).toHaveCount(0);
    await expect(table.locator("caption")).not.toContainText("갱신 전");
  });

  test(`@A7 ${width} 보석판: 금액이 길어져도 안 움직이고, 물들고, "N개 바뀜" 알림 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await watch(page);
    const served = await changing(page, /\/api\/markets\/auctions\/gems$/, (body) => {
      for (const cell of body.data.cells) if (cell.minBuyPrice != null) cell.minBuyPrice = up(cell.minBuyPrice);
    });
    await gotoReady(page, "/market/gems");
    const board = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" });
    await expect(board.getByRole("button", { name: /매물 보기$/ })).toHaveCount(19);
    await resetShifts(page);
    // The next look (the blank-cell fill, 5 s) brings the changed prices.
    await page.clock.runFor(6_000);
    await expect.poll(served).toBeGreaterThan(1);
    await expect.poll(() => board.locator(".chg-wash").count(), { message: "바뀐 칸 물들기" }).toBeGreaterThan(0);
    expect(await shifts(page), `갱신 뒤 흔들림(누르지 않음): ${await movedOf(page)}`).toBe(0);
    // One polite summary (at most every 1.6 s).
    await page.clock.runFor(1_700);
    await expect(page.getByRole("status").filter({ hasText: /^보석 시세 \d+개 바뀜\.$/ })).toHaveCount(1);
  });
}
