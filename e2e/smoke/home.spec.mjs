// 홈: 캐릭터 검색 진입점과 상단 메뉴.
// 홈 본문은 재구성 중(web #57)이라 두 구성에 모두 있는 "캐릭터 이름" 검색창만 기준으로 삼는다.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

test.describe("홈 @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("열리고 가로 스크롤이 없다", async ({ page }) => {
    await expect(page).toHaveTitle(/LOAKraken/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "LOAKraken 홈" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("캐릭터 이름을 검색하면 캐릭터 화면으로 이동한다", async ({ page }) => {
    const search = page.getByRole("textbox", { name: "캐릭터 이름" });
    await search.fill("상세");
    await search.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/character/${encodeURIComponent("상세")}$`));
    await expect(page.getByRole("heading", { level: 1, name: "상세" })).toBeVisible();
  });

  test("빈 입력은 이동하지 않고 안내한다", async ({ page }) => {
    const search = page.getByRole("textbox", { name: "캐릭터 이름" });
    await search.press("Enter");
    await expect(page.getByText("캐릭터 이름을 입력해 주세요.")).toBeVisible();
    await expect(search).toHaveAttribute("aria-invalid", "true");
    await expect(search).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
  });

  test("문자·숫자 외 입력은 이동하지 않고 안내한다", async ({ page }) => {
    const search = page.getByRole("textbox", { name: "캐릭터 이름" });
    await search.fill("상세!");
    await search.press("Enter");
    await expect(page.getByText("캐릭터 이름에는 문자와 숫자만 사용할 수 있어요.")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("64자를 넘는 입력은 이동하지 않고 안내한다", async ({ page }) => {
    const search = page.getByRole("textbox", { name: "캐릭터 이름" });
    await search.fill("가".repeat(70));
    await expect(search).toHaveValue("가".repeat(65));
    await search.press("Enter");
    await expect(page.getByText("캐릭터 이름은 64자 이내로 입력해 주세요.")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("상단 메뉴 @smoke", () => {
  test("주요 메뉴에서 시세와 성장 도구로 이동한다", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-390", "390px은 메뉴 시트를 쓴다(별도 테스트)");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "주요 메뉴" });
    await nav.getByRole("button", { name: "시세" }).click();
    await page.getByRole("link", { name: /거래소 시세/ }).click();
    await expect(page).toHaveURL(/\/market$/);
    await expect(page.getByRole("heading", { level: 1, name: "시세" })).toBeVisible();

    await nav.getByRole("button", { name: "성장 도구" }).click();
    await page.getByRole("link", { name: /재련 기대 비용/ }).click();
    await expect(page).toHaveURL(/\/tools\/refining$/);
  });

  test("390px에서는 메뉴 버튼으로 시트를 연다", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "모바일 전용");
    await page.goto("/");
    const open = page.getByRole("button", { name: "메뉴 열기" });
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await open.click();
    await expect(page.getByRole("button", { name: "메뉴 닫기" })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("link", { name: /거래소 시세/ }).click();
    await expect(page).toHaveURL(/\/market$/);
  });
});
