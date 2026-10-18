// QA v0.3.1 P2-5: after 직업 → 서버(or 분포) about 790px stayed empty between
// the table and the note under it (the room the tallest tab keeps, A7). The
// note now sits inside that room, right under each tab's content: the gap is
// the same as when the tab is opened directly, and a press moves nothing.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const note = (page) => page.getByRole("region", { name: "집계 기준 안내" });
/** From the bottom of the tab's own content (inside the panel's room) to the note's top. */
const gap = async (page) => {
  const content = await page.getByRole("tabpanel").evaluate((panel) => {
    const note = document.querySelector('[aria-label="집계 기준 안내"]');
    // Inside the tab: what comes right before it. Outside (under the panel):
    // the tab's own content, not the room the panel keeps.
    if (panel.contains(note)) return note.previousElementSibling?.getBoundingClientRect().bottom ?? null;
    const parts = [...(panel.firstElementChild?.children ?? [])];
    return parts.length ? Math.max(...parts.map((el) => el.getBoundingClientRect().bottom)) : null;
  });
  const top = await note(page).evaluate((el) => el.getBoundingClientRect().top);
  return content == null ? null : Math.round(top - content);
};
const settle = async (page) => {
  await expect(page.locator("main [aria-busy=true], main [data-stale]")).toHaveCount(0);
  await expect(note(page)).toBeVisible();
  await page.waitForTimeout(400);
};

for (const width of [1280, 360])
  test(`@A7 ${width} 통계: 탭을 옮겨도 표와 기준 안내 사이 간격은 직접 열 때와 같고 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const direct = {};
    for (const [tab, path] of [["서버", "/stats?tab=servers"], ["분포", "/stats?tab=distribution"]]) {
      await gotoReady(page, path);
      await settle(page);
      direct[tab] = await gap(page);
      expect(direct[tab], `${tab} 직접 열기 간격`).not.toBeNull();
    }

    await watchShifts(page);
    await gotoReady(page, "/stats");
    await settle(page);
    const tabs = page.getByRole("tablist", { name: "통계 보기" });
    for (const tab of ["서버", "분포"]) {
      const moved = await shiftsDuring(page, () => tabs.getByRole("tab", { name: tab }).click(), 1500);
      await settle(page);
      expect(moved.all, `${tab} 누름 흔들림 (${moved.moved})`).toBe(0);
      const now = await gap(page);
      expect(Math.abs(now - direct[tab]), `${tab}: 옮겨 온 간격 ${now} / 직접 ${direct[tab]}`).toBeLessThanOrEqual(4);
    }
  });
