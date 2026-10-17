// 회귀(A7): 홈·일정 '지난 회차 숨김'을 눌러도 줄과 남은 회차 시각이 움직이지 않는다(누른 직후 포함).
// 지난 시각은 자리만 두고 숨기고, 회차가 모두 지난 줄도 남아 '오늘 종료'로 읽힌다(PM-프론트 10-13).
// 지난 회차가 있는 시각에만 보이는 차이라 시계를 고정한다(목 모험 섬은 매일 09·11·13·19·21·23시).
// 고정 시계로는 첫 로드 흔들림을 재지 않는다: 첫 HTML의 '다음 회차' 묶음은 서버 시각으로 그려지고
// 브라우저의 고정 시각으로 다시 그려져, 실제(서버·브라우저 같은 시각)에는 없는 이동이 잡힌다.
// 첫 로드는 실제 시계로 도는 user-checklist·a7-controls가 잰다. 측정은 첫 그림이 가라앉은 뒤부터.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const kstAt = (hhmm) => Date.parse(`${kstToday()}T${hhmm}:00+09:00`);

for (const clock of ["13:30", "23:30"])
  for (const path of ["/", "/schedule"])
    for (const width of [1280, 360])
      test(`@A7 ${path} ${clock} 지난 회차 숨김 토글 흔들림 0 @${width} @regression`, async ({ page }) => {
        await page.clock.setFixedTime(kstAt(clock));
        await page.setViewportSize({ width, height: 900 });
        await watchShifts(page);
        await gotoReady(page, path);
        await page.waitForTimeout(500);
        const toggle = page.getByRole("button", { name: "지난 회차 숨김" });
        const islands = page.getByRole("region", { name: "모험 섬" });
        const rows = islands.getByRole("listitem");
        await expect(toggle).toHaveAttribute("aria-pressed", "true");
        const count = await rows.count();
        expect(count, "모든 줄이 남는다").toBeGreaterThan(0);
        // Page coordinates: the click may scroll the toggle into view first.
        const where = () =>
          rows.last().evaluate((el) => {
            const r = el.getBoundingClientRect();
            return [Math.round(r.left + scrollX), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)];
          });
        const before = await where();
        if (clock === "23:30") await expect(rows.first()).toContainText("오늘 종료");

        // Off: past rounds come back struck through in their own place.
        const off = await shiftsDuring(page, () => toggle.click());
        await expect(toggle).toHaveAttribute("aria-pressed", "false");
        await expect(islands.locator("time", { hasText: "09:00" }).first()).toBeVisible();
        await expect(islands.getByText("오늘 종료")).toHaveCount(0);
        expect(off.all, `숨김 끔 흔들림 (${off.moved})`).toBe(0);
        await expect(rows).toHaveCount(count);
        expect(await where(), "마지막 줄 위치·크기").toEqual(before);

        // On again: hidden, nothing moves.
        const on = await shiftsDuring(page, () => toggle.click());
        await expect(islands.locator("time", { hasText: "09:00" }).first()).toBeHidden();
        expect(on.all, `숨김 켬 흔들림 (${on.moved})`).toBe(0);
        expect(await where(), "마지막 줄 위치·크기").toEqual(before);
      });

/** WCAG contrast of an element's text on the first opaque background behind it. */
const contrastOf = (locator) =>
  locator.evaluate((el) => {
    const rgb = (value) => value.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, b]) => {
      const c = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    let node = el;
    let bg = "rgba(0, 0, 0, 0)";
    while (node && rgb(bg)[3] === 0) {
      bg = getComputedStyle(node).backgroundColor;
      node = node.parentElement;
    }
    const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(bg))].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });

for (const theme of ["light", "dim", "dark"])
  test(`@A7 23:30 '오늘 종료'는 ${theme}에서 대비 4.5:1 이상, 읽기에도 '오늘 종료' @regression`, async ({ page }) => {
    await page.clock.setFixedTime(kstAt("23:30"));
    await page.addInitScript((t) => localStorage.setItem("loakraken-theme", t), theme);
    await gotoReady(page, "/schedule");
    const islands = page.getByRole("region", { name: "모험 섬" });
    const ended = islands.getByText("오늘 종료").first();
    await expect(ended).toBeVisible();
    expect(await contrastOf(ended)).toBeGreaterThanOrEqual(4.5);
    // The hidden times are out of the reading order; the row reads "오늘 종료".
    await expect(islands.getByRole("listitem").first().locator("time").first()).toHaveAttribute("aria-hidden", "true");
    await expect(islands.getByRole("listitem").first()).toContainText("오늘 종료");
  });
