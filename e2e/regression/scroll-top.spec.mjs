// 회귀: 다른 탭으로 가는 이동은 페이지 맨 위에서 시작하고, 같은 화면 안 필터는 위치를 지킨다
// (사용자 10-11, PM 총괄 21:46). 탭이 바뀌면 포커스는 새 탭 패널 제목으로 간다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY));

test("스크롤을 내린 뒤 '자세히'로 다른 탭에 가면 맨 위에서 시작한다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  const more = page.getByRole("region", { name: "아크 패시브" }).getByRole("link", { name: "자세히" });
  // Scrolled on purpose, the link near the top: the panel may already be on
  // screen (the right column's order puts it high), and scrollIntoViewIfNeeded
  // then leaves the page at the top.
  await more.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120));
  expect(await scrollY(page)).toBeGreaterThan(200);
  await more.click();
  await expect(page).toHaveURL(/tab=arkpassive/);
  await expect.poll(() => scrollY(page)).toBe(0);
  await expect(page.getByRole("heading", { name: "아크 패시브 탭" })).toBeFocused();
});

test("탭 바로 탭을 바꿔도 맨 위로 간다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  await page.evaluate(() => window.scrollTo(0, 900));
  expect(await scrollY(page)).toBeGreaterThan(200);
  await page.getByRole("navigation", { name: "캐릭터 정보 탭" }).getByRole("link", { name: /스킬/ }).click();
  await expect(page).toHaveURL(/tab=skills/);
  await expect.poll(() => scrollY(page)).toBe(0);
  await expect(page.getByRole("heading", { name: "스킬 탭" })).toBeFocused();
});

test("처음 들어올 때는 포커스를 옮기지 않는다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "skills"));
  await expect(page.getByRole("heading", { name: "스킬 탭" })).not.toBeFocused();
});

test("같은 화면 안 정렬을 바꾸면 스크롤 위치를 지킨다 @regression", async ({ page }) => {
  await gotoReady(page, "/market");
  const sorts = page.getByRole("group", { name: "정렬" });
  await expect(sorts).toBeVisible();
  await page.evaluate(() => {
    const box = document.querySelector("[role=group][aria-label='정렬']").getBoundingClientRect();
    window.scrollBy(0, Math.max(0, box.top - 160));
  });
  const before = await scrollY(page);
  expect(before).toBeGreaterThan(0);
  await sorts.getByRole("button", { name: "고가" }).click();
  await expect(page).toHaveURL(/sort=high/);
  await page.waitForTimeout(300);
  expect(Math.abs((await scrollY(page)) - before)).toBeLessThanOrEqual(2);
});
