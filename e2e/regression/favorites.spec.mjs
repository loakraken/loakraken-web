// 회귀: 캐릭터 즐겨찾기는 이 브라우저에 저장된다(localStorage "loakraken:favorites").
// 새로고침·재접속(새 탭) 뒤에도 남고, 홈 검색 아래 즐겨찾기 목록에 보인다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

const star = (page) => page.getByRole("button", { name: /^즐겨찾기( 해제)?$/ });

test.describe("즐겨찾기 저장·재접속 @regression", () => {
  test("추가 → 새로고침 → 새 탭 홈 목록 → 해제", async ({ page, context }) => {
    await page.goto(characterPath("상세"));
    await expect(star(page)).toHaveAttribute("aria-pressed", "false");
    await star(page).click();
    await expect(page.getByRole("button", { name: "즐겨찾기 해제" })).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(page.getByRole("button", { name: "즐겨찾기 해제" })).toHaveAttribute("aria-pressed", "true");

    // 재접속: 같은 브라우저 저장소를 쓰는 새 탭
    const again = await context.newPage();
    await again.goto("/");
    const list = again.getByRole("list", { name: "즐겨찾기" });
    await expect(list.getByRole("link", { name: /상세/ })).toBeVisible();
    await list.getByRole("link", { name: /상세/ }).click();
    await expect(again).toHaveURL(new RegExp(`/character/${encodeURIComponent("상세")}`));

    await again.getByRole("button", { name: "즐겨찾기 해제" }).click();
    await expect(again.getByRole("button", { name: "즐겨찾기" })).toHaveAttribute("aria-pressed", "false");
    await again.goto("/");
    await expect(again.getByRole("list", { name: "즐겨찾기" }).getByRole("link", { name: /상세/ })).toHaveCount(0);
    await again.close();
  });

  test("저장소가 깨져 있어도 화면이 열린다", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("loakraken:favorites", "{not json"));
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: "캐릭터 이름" })).toBeVisible();
    await page.goto(characterPath("상세"));
    await expect(star(page)).toBeVisible();
  });
});
