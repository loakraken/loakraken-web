// 홈(정보 대시보드, web #58)과 소개(/about): 캐릭터 검색 진입점과 Ctrl K.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

for (const path of ["/", "/about"]) {
  test.describe(`${path} 검색 @smoke`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
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
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });

    test("문자·숫자 외 입력은 이동하지 않고 안내한다", async ({ page }) => {
      const search = page.getByRole("textbox", { name: "캐릭터 이름" });
      await search.fill("상세!");
      await search.press("Enter");
      await expect(page.getByText("캐릭터 이름에는 문자와 숫자만 사용할 수 있어요.")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });

    test("64자를 넘는 입력은 이동하지 않는다", async ({ page }) => {
      const search = page.getByRole("textbox", { name: "캐릭터 이름" });
      await search.fill("가".repeat(70));
      await search.press("Enter");
      // 입력란이 65자에서 잘리면(maxLength) 안내 문구, 아니면 같은 안내가 나온다.
      await expect(page.getByText("캐릭터 이름은 64자 이내로 입력해 주세요.")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });

    test("Ctrl K로 검색창에 포커스한다", async ({ page }) => {
      const search = page.getByRole("textbox", { name: "캐릭터 이름" });
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
      await expect(search).not.toBeFocused();
      await page.keyboard.press("Control+KeyK");
      await expect(search).toBeFocused();
    });
  });
}
