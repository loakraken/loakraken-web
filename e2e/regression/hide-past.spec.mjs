// 회귀(A7): 홈·일정 '지난 회차 숨김'을 눌러도 남은 회차 시각과 줄이 움직이지 않는다(누른 직후 포함).
// 지난 회차가 있는 시각에만 보이는 차이라 시계를 고정한다(목 모험 섬은 매일 09·11·13·19·21·23시).
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const kstAt = (hhmm) => Date.parse(`${kstToday()}T${hhmm}:00+09:00`);

for (const path of ["/", "/schedule"])
  for (const width of [1280, 360])
    test(`@A7 ${path} 13:30 지난 회차 숨김 토글 흔들림 0 @${width} @regression`, async ({ page }) => {
      await page.clock.setFixedTime(kstAt("13:30"));
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, path);
      await page.waitForTimeout(500);
      const toggle = page.getByRole("button", { name: "지난 회차 숨김" });
      const islands = page.getByRole("region", { name: "모험 섬" });
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      const at19 = islands.locator("time", { hasText: "19:00" }).first();
      const before = await at19.boundingBox();

      // Off: past rounds come back struck through in their own place.
      const off = await shiftsDuring(page, () => toggle.click());
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expect(islands.locator("time", { hasText: "09:00" }).first()).toBeVisible();
      expect(off.all, `숨김 끔 흔들림 (${off.moved})`).toBe(0);
      expect(await at19.boundingBox(), "남은 회차 시각 위치").toEqual(before);

      // On again: hidden, nothing moves.
      const on = await shiftsDuring(page, () => toggle.click());
      await expect(islands.locator("time", { hasText: "09:00" }).first()).toBeHidden();
      expect(on.all, `숨김 켬 흔들림 (${on.moved})`).toBe(0);
    });
