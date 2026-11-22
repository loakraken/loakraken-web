// PM-프론트 #1943 P2: the two refining totals ('목표까지 예상 비용' above the inputs and the result's own total) keep
// their '골드' in place when the first prices land (the number gets longer: 재련 골드 alone → + 사야 할 골드) and when
// a minute refresh changes the number's digit count. Measured on the unit's own box as well as the layout-shift log:
// a line drawn anew escapes the log (only nodes that existed and moved are reported), not the box.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const PRICED = /^시세 \d{2}:\d{2} 기준 · 1분마다 새로 불러와요$/;

for (const width of [320, 1280]) {
  test(`${width}: 첫 시세와 자릿수가 바뀌는 1분 갱신에도 두 합계의 '골드'가 제자리다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await watchShifts(page);
    // The first prices wait until the page is measured; from the minute refresh on, every price ×10 (one more digit).
    let release;
    const held = new Promise((resolve) => (release = resolve));
    let served = 0;
    await page.route("**/api/markets/material-prices", async (route) => {
      const call = ++served;
      if (call === 1) await held;
      const response = await route.fetch();
      const body = await response.json();
      const envelope = body.envelope ?? body;
      if (call > 1)
        for (const item of envelope.data.items)
          for (const key of ["unitPriceGold", "bundlePrice"]) if (item[key] != null) item[key] *= 10;
      await route.fulfill({ response, json: body });
    });
    await page.goto("/tools/refining");
    await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
    await expect(page.getByText("재련 골드(재료 시세를 불러오는 중…)")).toBeVisible();

    const totals = page.locator("p").filter({ has: page.locator(":scope > span", { hasText: /^골드$/ }) });
    await expect(totals).toHaveCount(2);
    // Each total: its number, where its '골드' sits, and whether the line holds its content.
    const read = () =>
      totals.evaluateAll((lines) =>
        lines.map((line) => {
          const unit = line.querySelector(":scope > span").getBoundingClientRect();
          return {
            number: line.textContent.replace(/골드$/, "").trim(),
            unit: { x: Math.round(unit.x * 10) / 10, y: Math.round(unit.y * 10) / 10 },
            fits: line.scrollWidth <= line.clientWidth + 1,
          };
        }),
      );
    // Past the click's input window: what moves from here is the prices.
    await page.waitForTimeout(600);
    const pending = await read();
    const mark = await shiftMark(page);

    release();
    await expect(page.getByText(PRICED)).toBeVisible();
    await expect.poll(async () => (await read()).map((t) => t.number)).not.toEqual(pending.map((t) => t.number));
    await page.waitForTimeout(400);
    const priced = await read();

    await page.clock.runFor(61_000);
    await expect.poll(() => served).toBe(2);
    await expect.poll(async () => (await read()).map((t) => t.number)).not.toEqual(priced.map((t) => t.number));
    await page.waitForTimeout(400);
    const refreshed = await read();

    const digits = (number) => number.replace(/\D/g, "").length;
    for (const [i, name] of ["위 합계", "결과 합계"].entries()) {
      // The refresh really changed the digit count (the case tabular-nums alone does not hold).
      expect(digits(refreshed[i].number), `${name} 자릿수 ${priced[i].number} → ${refreshed[i].number}`).toBeGreaterThan(
        digits(priced[i].number),
      );
      for (const [step, now] of [
        ["첫 시세", priced[i]],
        ["1분 갱신", refreshed[i]],
      ]) {
        expect(now.unit, `${name} '골드' 자리, ${step} (${pending[i].number} → ${now.number})`).toEqual(pending[i].unit);
        expect(now.fits, `${name} 줄 넘침, ${step}`).toBe(true);
      }
    }
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
}
