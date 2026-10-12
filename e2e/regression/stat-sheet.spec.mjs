// 회귀(캐릭터 화면 전수표 §14.1 ④): 특성 패널 '특성 자세히' — 특성합, 기본 특성 2장, 전투 특성 6장과 공식 문장.
// 넓은 화면은 가운데 창, 360은 아래 시트. Esc로 닫고 포커스는 버튼으로. 화면 넘침 없음.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

for (const width of [1280, 360]) {
  test(`@특성 ${width} 특성 자세히 창 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("특성상세"));
    const open = page.getByRole("button", { name: "특성 자세히" });
    await open.click();
    const sheet = page.getByRole("dialog", { name: "특성" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("특성합 2,749");
    await expect(sheet.getByRole("region", { name: "기본 특성" }).locator("li")).toHaveCount(2);
    const combat = sheet.getByRole("region", { name: "전투 특성" }).locator("li");
    await expect(combat).toHaveCount(6);
    await expect(combat.first()).toContainText("치명");
    await expect(combat.first()).toContainText("영구 증가");
    const box = await sheet.boundingBox();
    if (width === 360) expect(Math.round(box.y + box.height)).toBeGreaterThan(880);
    else expect(Math.round(box.width)).toBe(512);
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(open).toBeFocused();
  });
}
