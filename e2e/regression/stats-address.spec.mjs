// 통계 주소(PM-프론트 #1246 P2): 조건과 탭은 replaceState로 주소에 남는다(router.replace는 동적 화면을
// 다시 그려 흔들렸다, #1135). 화면 안에서 탭을 바꾼 뒤 상단 메뉴의 '전체 통계'를 누르면 직업 순위로 돌아온다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

test("조건 · 탭 변경은 주소만 바꾸고 화면을 다시 받지 않으며, 메뉴의 전체 통계로 직업 순위에 돌아온다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await watchShifts(page);
  await gotoReady(page, "/stats");
  // No document or RSC round trip for a condition change: only the stats answers.
  const pages = [];
  page.on("request", (r) => (r.resourceType() === "document" || r.url().includes("_rsc=")) && pages.push(r.url()));
  const moved = await shiftsDuring(page, () => page.getByRole("radiogroup", { name: "기간" }).getByRole("radio", { name: "7일" }).click(), 1500);
  await expect(page).toHaveURL(/activeDays=7/);
  expect(pages, "화면 다시 받기").toEqual([]);
  expect(moved.all, `기간 흔들림 (${moved.moved})`).toBe(0);

  await page.getByRole("tab", { name: "서버" }).click();
  await expect(page).toHaveURL(/tab=servers/);
  // The header's link to /stats: back to the first tab even though the page was never reloaded.
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await nav.getByRole("button", { name: "통계" }).click();
  await nav.getByRole("link", { name: /전체 통계/ }).click();
  await expect(page.getByRole("tab", { name: "직업 순위" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("table", { name: "직업별 인원과 전투력 분포" })).toBeVisible();
});
