// 공통 상단 메뉴(web #50·#56): 호버 플라이아웃, 키보드(↓·Esc), 900px 이하 메뉴 시트.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

// components/site/site-nav.module.css 의 max-width: 900px
const NARROW = 900;

test.describe("상단 메뉴 데스크톱 @smoke", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(page.viewportSize().width <= NARROW, "900px 이하는 메뉴 시트를 쓴다");
    await page.goto("/market");
  });

  test("메뉴에서 시세와 성장 도구로 이동한다", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "주요 메뉴" });
    await nav.getByRole("button", { name: "시세" }).click();
    await page.getByRole("link", { name: /거래소 시세/ }).click();
    await expect(page).toHaveURL(/\/market$/);
    await nav.getByRole("button", { name: "성장 도구" }).click();
    await page.getByRole("link", { name: /재련 기대 비용/ }).click();
    await expect(page).toHaveURL(/\/tools\/refining$/);
    await expect(page.getByRole("heading", { level: 1, name: "재련 기대 비용" })).toBeVisible();
  });

  test("성장 도구 메뉴에 경매 입찰가·도구 전체가 있고, 그 화면에서 현재 위치로 표시된다", async ({ page }) => {
    // web #90: 경매 입찰가 연결. 방향 전환(2026-10-10 §6): 돌파고 삭제, 도구 전체(/tools) 추가.
    const trigger = page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("button", { name: "성장 도구" });
    await trigger.click();
    const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
    await expect(panel.getByRole("link", { name: /경매 입찰가/ })).toHaveAttribute("href", "/tools/auction");
    await expect(panel.getByRole("link", { name: /돌파고/ })).toHaveCount(0);
    await panel.getByRole("link", { name: /도구 전체/ }).click();
    await expect(page).toHaveURL(/\/tools$/);
    await expect(trigger).toHaveAttribute("data-current", "true");
    await page.goto("/tools/auction");
    await expect(trigger).toHaveAttribute("data-current", "true");
  });

  test("성장 도구 메뉴에서 전투력 시뮬레이터로 간다(사용자 지적 10-11)", async ({ page }) => {
    const trigger = page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("button", { name: "성장 도구" });
    await trigger.click();
    const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
    await panel.getByRole("link", { name: /전투력 시뮬레이터/ }).click();
    await expect(page).toHaveURL(/\/tools\/combat-power$/);
    await expect(page.getByRole("heading", { level: 1, name: "전투력 시뮬레이터" })).toBeVisible();
    await expect(trigger).toHaveAttribute("data-current", "true");
  });

  test("호버하면 플라이아웃이 열린다", async ({ page }) => {
    const trigger = page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("button", { name: "성장 도구" });
    await trigger.hover();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`#${await trigger.getAttribute("aria-controls")}`)).toBeVisible();
  });

  test("↓로 첫 링크에 포커스하고 Esc로 닫으면 탭에 포커스가 돌아온다", async ({ page }) => {
    const trigger = page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("button", { name: "성장 도구" });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
    await expect(panel.getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("←·→로 메뉴 탭 사이를 옮긴다", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "주요 메뉴" });
    await nav.getByRole("button", { name: "시세" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(nav.getByRole("button", { name: "성장 도구" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(nav.getByRole("button", { name: "시세" })).toBeFocused();
  });
});

test.describe("상단 메뉴 시트(900px 이하) @smoke", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(page.viewportSize().width > NARROW, "900px 이하 전용");
  });

  test("메뉴 버튼으로 시트를 열고 이동한다", async ({ page }) => {
    await gotoReady(page, "/");
    const open = page.getByRole("button", { name: "메뉴 열기" });
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await open.click();
    const close = page.getByRole("button", { name: "메뉴 닫기" });
    await expect(close).toHaveAttribute("aria-expanded", "true");
    // 홈 바로 가기에도 같은 이름 링크가 있어 메뉴 시트 안에서 찾는다
    const sheet = page.locator(`[id="${await close.getAttribute("aria-controls")}"]`);
    await sheet.getByRole("link", { name: /거래소 시세/ }).click();
    await expect(page).toHaveURL(/\/market$/);
  });

  test("Esc로 시트를 닫으면 메뉴 버튼에 포커스가 돌아온다", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await expect(page.getByRole("button", { name: "메뉴 닫기" })).toBeVisible();
    await page.keyboard.press("Escape");
    const open = page.getByRole("button", { name: "메뉴 열기" });
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await expect(open).toBeFocused();
  });
});
