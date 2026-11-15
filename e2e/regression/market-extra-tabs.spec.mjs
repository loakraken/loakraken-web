// 기능(흡수 웨이브 1 #11): 시세에 '아바타'와 '장비 상자' 분류가 더해진다. 티어 없이(생활·요리처럼) 같은 정렬·검색을 쓰고,
// 탭 줄에 두 탭이 다른 탭과 같은 모양으로 놓인다. 눌러 바꿀 때 흔들림 0, 휴대폰에서도 옆으로 넘치지 않는다.
// (11-14 PM 총괄: 장비 상자는 api 탭 목록에서 빠져 있어 줄에도 없다.)
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 390, 320])
  test(`@A7 ${width} 시세 아바타 분류: 티어 없이 보드, 바꿀 때 흔들림 0(장비 상자는 줄에 없음) @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market");
    const tabs = page.getByRole("navigation", { name: "시세 분류" });
    // 장비 상자 is not offered: the api's tab list leaves it out, so the row does too (PM 총괄 11-14).
    await expect(tabs.getByText("장비 상자")).toHaveCount(0);
    for (const [label, id] of [["아바타", "AVATAR"]]) {
      const tab = tabs.getByRole("link", { name: label, exact: true });
      await expect(tab).toHaveAttribute("href", `/market?tab=${id}`);
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

// The row is one fixed list (codex #1597 P2-2): while the api's tab list has not arrived (slow or failed) it
// already holds every category it will show, the same as after, so nothing is put in front of 보석 · 장신구 later.
// Every api in service opens 아바타 (api #873, master since 11-09), so the earlier stand-in eight are gone;
// 장비 상자 is never in the row (the api's list leaves it out).
test("시세 분류: 탭 목록을 기다리는 동안에도 같은 11개 줄, 목록이 와도 그대로 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // The page is drawn on the server with the tab list already in it, so the wait shows only when that
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
  const tabs = page.getByRole("navigation", { name: "시세 분류" }).getByRole("link");
  await expect(tabs).toHaveCount(11);
  const before = await tabs.allTextContents();
  expect(before.slice(-3)).toEqual(["아바타", "보석", "장신구"]);
  const width = await page.getByRole("navigation", { name: "시세 분류" }).locator("ul").evaluate((el) => el.offsetWidth);
  const arrived = page.waitForResponse("**/api/markets/tabs*");
  release();
  await arrived;
  await page.waitForTimeout(300);
  expect(await tabs.allTextContents()).toEqual(before);
  expect(await page.getByRole("navigation", { name: "시세 분류" }).locator("ul").evaluate((el) => el.offsetWidth)).toBe(width);
});
