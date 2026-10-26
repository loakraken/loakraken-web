// 회귀(#1113·#1119): 검색 드롭다운의 '최근 본 캐릭터 / 즐겨찾기' 탭, 즐겨찾기(이 브라우저에만),
// 캐릭터 화면 검색 칸도 같은 드롭다운, 검색 막대의 둥근 보내기 단추 없음.
// - 탭은 진짜 탭(←/→ 전환, Esc는 입력칸에서처럼 닫힘), 빈 즐겨찾기는 한 줄 안내.
// - 줄에서 Shift+Enter로 넣고 빼며, 넣은 줄의 읽히는 이름에 '즐겨찾기됨', 상태 줄로 알림.
// - 줄의 즐겨찾기 표시를 눌러도 그 줄로 이동하지 않는다. 캐릭터 화면 즐겨찾기 단추(aria-pressed).
// - 저장소가 막혀도 오류 없이 안내. 320/360/390/1280 × 밝게·어둡게 패널 화면 밖 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const RECENT = [{ name: "상세", server: "아만", className: "블래스터", itemLevel: 1780.83, at: 1 }];
const seedRecent = (page) =>
  page.addInitScript((list) => {
    try {
      localStorage.setItem("loakraken:recent", JSON.stringify(list));
    } catch {}
  }, RECENT);

async function openSearch(page, path = "/market") {
  await gotoReady(page, path);
  await page.getByRole("button", { name: "캐릭터 검색" }).first().click();
  const box = page.getByRole("combobox", { name: "캐릭터 이름" });
  await expect(box).toBeFocused();
  return box;
}
const list = (page) => page.getByRole("listbox", { name: "검색 결과" });

test("탭: 최근 본 / 즐겨찾기, ←/→로 바꾸고 빈 즐겨찾기는 한 줄 안내, 탭에서 Esc도 닫힌다 @regression", async ({ page }) => {
  await seedRecent(page);
  await openSearch(page);
  const recent = page.getByRole("tab", { name: "최근 본 캐릭터" });
  const fav = page.getByRole("tab", { name: "즐겨찾기" });
  await expect(recent).toHaveAttribute("aria-selected", "true");
  await expect(list(page).getByRole("option", { name: /^상세/ })).toBeVisible();
  await fav.click();
  await expect(fav).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("캐릭터의 즐겨찾기 표시를 누르면 여기에 모아 둘 수 있어요.")).toBeVisible();
  // Keyboard on the tabs (manual activation): ← moves to 최근 본, Enter picks it; focus stays on the tab.
  await fav.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(recent).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(recent).toHaveAttribute("aria-selected", "true");
  await expect(recent).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(list(page)).toHaveCount(0);
});

test("Shift+Enter로 즐겨찾기에 넣고(읽히는 이름·상태 줄), 새로 고침에도 남고, 줄의 표시를 눌러 빼도 이동하지 않는다 @regression", async ({ page }) => {
  await seedRecent(page);
  const box = await openSearch(page);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(`[id="${await box.getAttribute("aria-activedescendant")}"]`)).toContainText("상세");
  await page.keyboard.press("Shift+Enter");
  await expect(page.getByRole("status").filter({ hasText: "‘상세’ 즐겨찾기 추가" })).toHaveCount(1);
  await expect(list(page).getByRole("option", { name: /상세 · 즐겨찾기됨/ })).toBeVisible();
  await page.getByRole("tab", { name: "즐겨찾기" }).click();
  await expect(list(page).getByRole("option", { name: /상세/ })).toBeVisible();

  // Kept after a reload, and the tab is remembered.
  await page.keyboard.press("Escape");
  await page.reload();
  await openSearch(page);
  await expect(page.getByRole("tab", { name: "즐겨찾기" })).toHaveAttribute("aria-selected", "true");
  const row = list(page).getByRole("option", { name: /상세/ });
  await expect(row).toBeVisible();
  // The row's mark (mouse/touch): unstars without opening the row; hit area ≥ 24px.
  const star = row.locator("[data-slot=row-star]");
  const size = await star.boundingBox();
  expect(Math.min(size.width, size.height), "표시 누름 영역").toBeGreaterThanOrEqual(24);
  await star.click();
  await expect(page).toHaveURL(/\/market$/);
  await expect(page.getByText("캐릭터의 즐겨찾기 표시를 누르면 여기에 모아 둘 수 있어요.")).toBeVisible();
});

test("최근 목록에 없는 즐겨찾기는 이름만(빈 서버·직업 자리 없음, 잘림 없음), 입력 중 숨은 탭은 읽히지 않는다 @regression", async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("loakraken:favorites", JSON.stringify(["상세서포터"]));
      localStorage.setItem("loakraken:search-tab", "favorites");
    } catch {}
  });
  const box = await openSearch(page);
  const row = list(page).getByRole("option", { name: /상세서포터/ });
  await expect(row).toBeVisible();
  await expect(row.locator(".rsp-sub")).toHaveCount(0);
  // The side holds the star alone: no empty server text before it.
  expect((await row.locator(".rsp-side").innerText()).trim()).toBe("");
  const cut = await row.locator(".rsp-name").evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(cut, "이름 잘림").toBe(false);
  // Typing hides the tab row in place: inert, so out of the tree and the Tab order.
  await box.fill("상");
  await expect(page.locator("[data-slot=search-tabs]")).toHaveAttribute("inert", "");
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("tab", { includeHidden: true }).first()).not.toBeFocused();
});

test("캐릭터 화면: 즐겨찾기 단추(눌림 상태)와 같은 드롭다운의 검색 칸 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, characterPath("상세"));
  // The page's own 즐겨찾기 button (tab bar, wide screens), the same list as the dropdown.
  const toggle = page.getByRole("button", { name: /^즐겨찾기( 해제)?$/ }).and(page.locator("[aria-pressed]")).last();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // The page's own search box opens the same panel (tabs, the favourite listed).
  const field = page.locator("#detail-search");
  await field.focus();
  await expect(list(page)).toBeVisible();
  await expect(field).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("tab", { name: "즐겨찾기" }).click();
  await expect(list(page).getByRole("option", { name: /상세 · 즐겨찾기됨/ })).toBeVisible();
  // Typing: the same character rows and keys as the header search.
  await field.fill("상");
  const support = list(page).getByRole("option", { name: /상세서포터/ });
  await expect(support).toBeVisible();
  await field.press("ArrowDown");
  await field.press("ArrowDown");
  await expect(page.locator(`[id="${await field.getAttribute("aria-activedescendant")}"]`)).toContainText("상세서포터");
  await field.press("Escape");
  await expect(list(page)).toHaveCount(0);
  // Reopened by typing, then Enter on the active row goes there.
  await field.fill("상세서");
  await expect(support).toBeVisible();
  await field.press("ArrowDown");
  await field.press("ArrowDown");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/character\/%EC%83%81%EC%84%B8%EC%84%9C%ED%8F%AC%ED%84%B0$/);
});

test("저장소가 막혀도 오류 없이: 즐겨찾기 탭과 Shift+Enter가 안내만 한다 @regression", async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Storage.prototype.setItem = blocked;
    Storage.prototype.getItem = blocked;
    Storage.prototype.removeItem = blocked;
  });
  const box = await openSearch(page);
  await page.getByRole("tab", { name: "즐겨찾기" }).click();
  await expect(page.getByText("이 브라우저는 저장소를 쓸 수 없어 즐겨찾기를 저장하지 못해요.").first()).toBeVisible();
  await page.getByRole("tab", { name: "최근 본 캐릭터" }).click();
  await box.focus();
  await page.keyboard.type("상");
  await expect(list(page).getByRole("option", { name: /상세서포터/ })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Shift+Enter");
  await expect(page.getByRole("status").filter({ hasText: "저장소를 쓸 수 없어" })).toHaveCount(1);
});

for (const scheme of ["light", "dark"])
  for (const width of [320, 360, 390, 1280])
    test(`${scheme} ${width}: 탭이 있는 패널이 화면 안, 가로 넘침 0 @regression`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 800 });
      await seedRecent(page);
      await openSearch(page);
      await expect(page.getByRole("tab", { name: "즐겨찾기" })).toBeVisible();
      const panel = await page.locator(".rsp").boundingBox();
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      // Each tab's label text inside its tab (the pill layer's clipped copies are by design).
      const cut = await page.locator(".rsp-top [role=tab]").evaluateAll((els) =>
        els
          .filter((el) => {
            const box = el.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(el);
            const text = range.getBoundingClientRect();
            return text.left < box.left - 1 || text.right > box.right + 1;
          })
          .map((el) => el.textContent),
      );
      expect(cut, "탭·안내 잘림").toEqual([]);
      await expectNoHorizontalOverflow(page);
    });
