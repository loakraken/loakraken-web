// 기능(흡수 웨이브 1 #11): 시세에 '아바타'와 '장비 상자' 분류가 더해진다. 티어 없이(생활·요리처럼) 같은 정렬·검색을 쓰고,
// 탭 줄에 두 탭이 다른 탭과 같은 모양으로 놓인다. 눌러 바꿀 때 흔들림 0, 휴대폰에서도 옆으로 넘치지 않는다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 390, 320])
  test(`@A7 ${width} 시세 아바타·장비 상자 분류: 티어 없이 보드, 바꿀 때 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market");
    const tabs = page.getByRole("tablist", { name: "시세 분류" });
    for (const [label, id] of [
      ["아바타", "AVATAR"],
      ["장비 상자", "EQUIPMENT_BOX"],
    ]) {
      const tab = tabs.getByRole("tab", { name: label, exact: true });
      await expect(tab).toBeEnabled();
      await tab.scrollIntoViewIfNeeded();
      const moved = await shiftsDuring(page, () => tab.click());
      await expect(page).toHaveURL(new RegExp(`tab=${id}`));
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${label} 시세`) })).toBeVisible();
      await expect(page.locator("section[aria-labelledby=board-heading] li button").first()).toBeVisible();
      // No tier on these kinds.
      await expect(page.getByRole("group", { name: "티어" })).toHaveCount(0);
      expect(moved.all, `${label} 탭 누를 때 흔들림 (${moved.moved})`).toBe(0);
      await expectNoHorizontalOverflow(page);
    }
  });

// While the tab list has not arrived (slow or failed), the stand-in tabs are the long-standing eight only: an api
// before #873 must never be offered 아바타 or 장비 상자 (codex on #1476). They come with the api's own list.
test("시세 분류: 탭 목록을 기다리는 동안의 자리 탭에는 아바타·장비 상자가 없음 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // The page is drawn on the server with the tab list already in it, so the stand-ins show only when that
  // list could not be had: this client's address makes the mock backend refuse it (tests/mock-backend.mjs).
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.180" });
  let release;
  const held = new Promise((resolve) => (release = resolve));
  // The browser then asks for the list itself: held, and let through later as another client (so it arrives).
  await page.route("**/api/markets/tabs*", async (route) => {
    await held;
    await route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": "203.0.113.1" } });
  });
  // Not gotoReady: its network-idle wait would never end while the list is held.
  await page.goto("/market");
  const tabs = page.getByRole("tablist", { name: "시세 분류" });
  await expect(tabs.getByRole("tab", { name: "재련 재료", exact: true })).toBeDisabled();
  // The long-standing eight, then 보석 · 장신구 (pages of their own, never held back).
  await expect(tabs.getByRole("tab")).toHaveCount(10);
  await expect(tabs.getByRole("tab", { name: "아바타", exact: true })).toHaveCount(0);
  await expect(tabs.getByRole("tab", { name: "장비 상자", exact: true })).toHaveCount(0);
  // The api's list arrives (it has both here): now they are there and can be opened.
  release();
  await expect(tabs.getByRole("tab", { name: "아바타", exact: true })).toBeEnabled();
  await expect(tabs.getByRole("tab", { name: "장비 상자", exact: true })).toBeEnabled();
});
