// 회귀(캐릭터 화면 전수표, 전투 탭 카드): 원정대 카드 기록 머리의 도움말 — 눌러서 열림(터치 포함), Esc로 닫힘.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("원정대 카드 기록 도움말: 눌러서 열고 Esc로 닫는다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  const help = page.getByRole("button", { name: "원정대 카드 기록 도움말" }).first();
  await help.click();
  const dialog = page.getByRole("dialog", { name: "원정대 카드 기록" });
  await expect(dialog).toContainText("가장 높은 각성을 기록해요");
  await expect(dialog).toContainText("기록 채우기");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(help).toBeFocused();
});
