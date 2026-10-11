// 회귀: 헤더 돋보기 검색창 아래 결과 패널(PM 총괄 10-12 01:07·01:11, 일로아식 내용).
// 빈 칸: 실시간 인기 캐릭터·기능(테마·문의·링크 복사). 입력: 메뉴 결과, "'이름' 캐릭터 정보 보기",
// 이름 자동완성(백엔드 #372, 입력 글자 굵게). 입력칸이 포커스를 지키는 콤보박스: ↑↓·Enter·Esc.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

async function openSearch(page) {
  await gotoReady(page, "/market");
  await page.getByRole("button", { name: "캐릭터 검색" }).click();
  const box = page.getByRole("combobox", { name: "캐릭터 이름" });
  await expect(box).toBeFocused();
  return box;
}

test("빈 칸이면 인기 캐릭터와 기능이 보이고, 입력칸이 결과 목록을 가리킨다 @regression", async ({ page }) => {
  const box = await openSearch(page);
  const list = page.getByRole("listbox", { name: "검색 결과" });
  await expect(list).toBeVisible();
  await expect(box).toHaveAttribute("aria-controls", await list.getAttribute("id"));
  await expect(list.getByRole("group", { name: "기능" })).toBeVisible();
  for (const name of ["테마 바꾸기", "문의하기", "지금 페이지 링크 복사"])
    await expect(list.getByRole("option", { name: new RegExp(name) })).toBeVisible();
  await expect(list.getByRole("group", { name: "실시간 인기 캐릭터" })).toBeVisible();
  await expect(page.getByText("↑↓ 이동, Enter 열기, Esc 닫기")).toBeVisible();

  // ↓ moves the active row; the field keeps focus and points at it.
  await page.keyboard.press("ArrowDown");
  const active = await box.getAttribute("aria-activedescendant");
  expect(active).toBeTruthy();
  await expect(page.locator(`[id="${active}"]`)).toHaveAttribute("aria-selected", "true");
  await expect(box).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
});

test("테마 바꾸기 줄은 다음 테마로 바꾸고 창을 닫지 않는다 @regression", async ({ page }) => {
  await openSearch(page);
  const row = page.getByRole("option", { name: /테마 바꾸기/ });
  await expect(row).toContainText("지금 라이트 · 누르면 딤");
  await row.click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dim");
  await expect(row).toContainText("지금 딤 · 누르면 다크");
});

test("입력하면 메뉴 결과가 나오고 누르면 그 화면으로 간다 @regression", async ({ page }) => {
  await openSearch(page);
  await page.keyboard.type("숙제");
  const menu = page.getByRole("group", { name: "메뉴" });
  await expect(menu.getByRole("option", { name: /숙제 체크/ })).toBeVisible();
  await menu.getByRole("option", { name: /숙제 체크/ }).click();
  await expect(page).toHaveURL(/\/tools\/homework$/);
});

test("이름을 치면 정보 보기 줄과 자동완성이 나오고, ↓ Enter로 고른 캐릭터로 간다 @regression", async ({ page }) => {
  const box = await openSearch(page);
  await page.keyboard.type("상");
  const characters = page.getByRole("group", { name: "캐릭터" });
  await expect(characters.getByRole("option", { name: /‘상’ 캐릭터 정보 보기/ })).toBeVisible();
  // 입력 직후 Enter는 늘 하던 대로 '정보 보기'를 가리킨다.
  const lookup = await box.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${lookup}"]`)).toContainText("정보 보기");
  const support = characters.getByRole("option", { name: /상세서포터/ });
  await expect(support).toBeVisible();
  await expect(support.locator("b")).toHaveText("상");
  // 정보 보기 → 상세 → 상세서포터
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(`[id="${await box.getAttribute("aria-activedescendant")}"]`)).toContainText("상세서포터");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/character\/%EC%83%81%EC%84%B8%EC%84%9C%ED%8F%AC%ED%84%B0$/);
});

for (const width of [1440, 360]) {
  test(`@A7 ${width}: 자동완성이 늦게 와도 패널 안 줄과 안내가 밀리지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(() => {
      window.__quiet = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__quiet += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.route("**/api/characters/suggest**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await openSearch(page);
    const before = await page.evaluate(() => window.__quiet);
    await page.keyboard.type("상");
    await expect(page.getByRole("option", { name: /상세서포터/ })).toBeVisible();
    await page.waitForTimeout(400);
    expect((await page.evaluate(() => window.__quiet)) - before, "자동완성이 온 뒤 흔들림").toBe(0);
  });
}
