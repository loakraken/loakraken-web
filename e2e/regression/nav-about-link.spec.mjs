// 회귀(사용자 11-08): 머리글 메뉴의 '소개'는 '서비스 소개' 하나뿐이라 펼침 창 없이 바로 /about#intro로
// 간다. 다른 메뉴는 그대로 펼침 창, 펼친 창은 '소개' 위로 포인터가 오면 닫힌다, 화살표 키로 지나간다.
// 휴대폰 메뉴의 소개에는 '서비스 소개' 한 줄. 소개 페이지의 다른 부분은 머리글 검색으로 찾는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const nav = (page) => page.getByRole("navigation", { name: "주요 메뉴" });

test("1280: 소개는 바로 가는 링크, 다른 메뉴는 펼침 창 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market");
  const about = nav(page).getByRole("link", { name: "소개", exact: true });
  await expect(about).toHaveAttribute("href", "/about#intro");
  await expect(nav(page).getByRole("button", { name: "소개" })).toHaveCount(0);
  await expect(nav(page).getByRole("link", { name: /캐릭터 미리보기|근거 보기|로드맵/ })).toHaveCount(0);

  // Another tab still previews its panel on hover; reaching 소개 closes it.
  const character = nav(page).getByRole("button", { name: "캐릭터" });
  await character.hover();
  await expect(character).toHaveAttribute("aria-expanded", "true");
  await about.hover();
  await expect(character).toHaveAttribute("aria-expanded", "false");

  // Keyboard: ← from 캐릭터 lands on 소개 (no panel opens), ↓ on 소개 opens nothing.
  await character.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(about).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(nav(page).locator("[aria-expanded='true']")).toHaveCount(0);

  await about.click();
  await expect(page).toHaveURL(/\/about#intro$/);
});

test("390: 휴대폰 메뉴의 소개는 '서비스 소개' 한 줄 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReady(page, "/market");
  await nav(page).getByRole("button", { name: "메뉴 열기" }).click();
  const section = nav(page).locator("section").filter({ has: page.getByRole("heading", { name: "소개", exact: true }) });
  await expect(section.getByRole("link")).toHaveCount(1);
  await expect(section.getByRole("link")).toContainText("서비스 소개");
  await expect(section.getByRole("link")).toHaveAttribute("href", "/about#intro");
});
