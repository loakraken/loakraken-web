// 회귀(#1967, #1948 리뷰 P3): 시뮬레이터의 젬 줄을 펼치면 편집 칸이 그 누름에서 바로 그려진다. 펼침 이벤트(toggle)는 한
// 작업 뒤에 와서, 그것만 기다리면 펼친 첫 프레임에 줄만 열리고 칸이 비었다. 누른 뒤 마이크로태스크 하나(React가 누름의 갱신을
// 그리는 때) 뒤, toggle이 오기 전에 편집 칸이 있어야 한다. 키보드(Enter)도 같다.
import { test, expect } from "../support/fixtures.mjs";

const path = `/tools/combat-power?character=${encodeURIComponent("전투력젬바꿈")}`;

test("젬 줄을 누른 그 순간 편집 칸이 있다(toggle을 기다리지 않음) @regression", async ({ page }) => {
  await page.goto(path);
  const card = page.getByRole("region", { name: "아크 그리드 젬", exact: true });
  await expect(card.locator("summary").first()).toBeVisible();
  await page.waitForFunction(() => window.__lkHydrated);
  const early = await card.locator("summary").first().evaluate(async (summary) => {
    let toggled = false;
    summary.parentElement.addEventListener("toggle", () => (toggled = true), { once: true });
    summary.click();
    await new Promise((done) => queueMicrotask(done));
    return { fields: summary.parentElement.querySelectorAll("[role=combobox]").length, toggled };
  });
  expect(early.toggled, "toggle 전에 잼").toBe(false);
  expect(early.fields, "누름 직후 편집 칸 수").toBeGreaterThan(0);
  // Closing again: the editor goes (the toggle syncs), and Enter on the summary opens it the same way.
  const summary = card.locator("summary").first();
  await summary.click();
  await expect(card.locator("details").first().getByRole("combobox")).toHaveCount(0);
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(card.locator("details").first().getByRole("combobox").first()).toBeVisible();
});
