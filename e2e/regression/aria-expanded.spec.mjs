// 회귀: 펼침·접기 버튼은 aria-expanded로 상태를 알린다(WAI-ARIA disclosure).
// 2026-10-08 PM 검토(web #54)에서 아크 그리드 '모두 펼치기'의 aria-expanded 누락을 지적해 고쳤다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

// 내용을 펼치거나 접는 버튼 문구.
const TOGGLE_LABEL = /(펼치기|접기|\d+개 (스킬|기록) 보기|스킬만 보기)$/;
const TABS = ["combat", "simulator", "skills", "arkpassive", "collectibles", "avatars", "stats", "siblings", "evidence"];

test.describe("aria-expanded @regression", () => {
  test("아크 그리드 아래 화살표가 상태를 알리고 코어를 모두 연다", async ({ page }) => {
    // 머리 줄 '모두 펼치기'는 같은 일을 해서 지웠다(사용자 10-12). 아래 화살표만 남는다.
    await page.goto(characterPath("상세"));
    const panel = page.getByRole("region", { name: "아크 그리드" });
    await expect(panel.getByRole("button", { name: /^모두 (펼치기|접기)$/ })).toHaveCount(0);
    const toggle = panel.getByRole("button", { name: "아크 그리드 코어 전체 펼치기" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    const collapse = panel.getByRole("button", { name: "아크 그리드 코어 전체 접기" });
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    const cores = panel.locator("details");
    expect(await cores.count()).toBeGreaterThan(0);
    for (const core of await cores.all()) await expect(core).toHaveAttribute("open", "");
    await collapse.click();
    await expect(panel.getByRole("button", { name: "아크 그리드 코어 전체 펼치기" })).toHaveAttribute("aria-expanded", "false");
  });

  test("아크 그리드 코어는 하나씩 따로 펼치고, 줄 끝 화살표가 뒤집힌다", async ({ page }) => {
    await page.goto(characterPath("상세"));
    const cores = page.getByRole("region", { name: "아크 그리드" }).locator("details");
    const first = cores.first();
    const arrow = first.locator("summary svg[class*=coreChevron]");
    await expect(arrow).toBeVisible();
    await first.locator("summary [class*=itemText]").click();
    await expect(first).toHaveAttribute("open", "");
    await expect(cores.nth(1)).not.toHaveAttribute("open", "");
    await expect.poll(() => arrow.evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
  });

  test("통계 '기록 보기'가 상태를 알린다", async ({ page }) => {
    await page.goto(characterPath("상세", "stats"));
    const toggle = page.getByRole("button", { name: /\d+개 기록 보기/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(page.getByRole("button", { name: "접기" })).toHaveAttribute("aria-expanded", "true");
  });

  test("스킬 탭 '전체 N개 스킬 보기'가 상태를 알린다", async ({ page }) => {
    await page.goto(characterPath("상세", "skills"));
    const toggle = page.getByRole("button", { name: /전체 \d+개 스킬 보기/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // web #90: aria-controls가 스킬 목록을 가리킨다.
    const controls = await toggle.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    await expect(page.locator(`[id="${controls}"]`)).toBeVisible();
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
