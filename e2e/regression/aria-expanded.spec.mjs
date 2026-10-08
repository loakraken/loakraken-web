// 회귀: 펼침·접기 버튼은 aria-expanded로 상태를 알린다(WAI-ARIA disclosure).
// 2026-10-08 PM 검토(web #54)에서 아크 그리드 '모두 펼치기'의 aria-expanded 누락을 지적해 고쳤다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

// 내용을 펼치거나 접는 버튼 문구.
const TOGGLE_LABEL = /(펼치기|접기|\d+개 (스킬|기록) 보기|스킬만 보기)$/;
const TABS = ["combat", "skills", "arkpassive", "collectibles", "avatars", "stats", "siblings", "evidence"];

test.describe("aria-expanded @regression", () => {
  test("아크 그리드 '모두 펼치기'가 상태를 알리고 코어를 모두 연다", async ({ page }) => {
    await page.goto(characterPath("상세"));
    const toggle = page.getByRole("button", { name: "모두 펼치기" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    const collapse = page.getByRole("button", { name: "모두 접기" });
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    const cores = page.getByRole("region", { name: "아크 그리드" }).locator("details");
    expect(await cores.count()).toBeGreaterThan(0);
    for (const core of await cores.all()) await expect(core).toHaveAttribute("open", "");
    await collapse.click();
    await expect(page.getByRole("button", { name: "모두 펼치기" })).toHaveAttribute("aria-expanded", "false");
  });

  test("통계 '기록 보기'가 상태를 알린다", async ({ page }) => {
    await page.goto(characterPath("상세", "stats"));
    const toggle = page.getByRole("button", { name: /\d+개 기록 보기/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(page.getByRole("button", { name: "접기" })).toHaveAttribute("aria-expanded", "true");
  });

  test("스킬 탭 '전체 N개 스킬 보기'가 상태를 알린다", async ({ page }) => {
    test.fail(true, "web #66: 스킬 펼침 버튼 aria-expanded 누락. 고치면 이 줄을 지운다.");
    await page.goto(characterPath("상세", "skills"));
    const toggle = page.getByRole("button", { name: /전체 \d+개 스킬 보기/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(page.getByRole("button", { name: "사용 중인 스킬만 보기" })).toHaveAttribute("aria-expanded", "true");
  });

  test("상단 메뉴 버튼이 플라이아웃 상태를 알린다", async ({ page }) => {
    await page.goto("/market");
    const nav = page.getByRole("navigation", { name: "주요 메뉴" });
    const button = nav.getByRole("button", { name: "성장 도구" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator(`#${await button.getAttribute("aria-controls")}`);
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  for (const tab of TABS) {
    test(`${tab} 탭의 모든 펼침 버튼에 aria-expanded가 있다`, async ({ page }) => {
      test.fail(tab === "skills", "web #66: 스킬 펼침 버튼 aria-expanded 누락. 고치면 이 줄을 지운다.");
      await page.goto(characterPath("상세", tab));
      await expect(page.getByRole("heading", { level: 1, name: "상세" })).toBeVisible();
      const missing = await page.locator("main button:visible").evaluateAll(
        (buttons, source) => {
          const label = new RegExp(source);
          return buttons
            .filter((b) => label.test(b.innerText.trim()) && !b.hasAttribute("aria-expanded"))
            .map((b) => b.innerText.trim());
        },
        TOGGLE_LABEL.source,
      );
      expect(missing, "aria-expanded가 없는 펼침 버튼").toEqual([]);
    });
  }
});
