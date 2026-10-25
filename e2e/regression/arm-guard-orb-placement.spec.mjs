// 회귀(사용자 의견 10-26): 완갑은 장비라 '전투' 탭 장비 목록에서 무기 바로 아래(#1098), 내실 탭 '특수 장비'에는
// 완갑·보주가 없다(#1102). 보주는 원래 자리('전투' 탭 장비 아래쪽)에 그대로 있다. 첫 그림부터 같은 순서, 흔들림 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [320, 360, 390, 1280])
  test(`완갑은 무기 바로 아래, 보주는 장비 아래쪽 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    const panel = page.getByRole("region", { name: "장비", exact: true });
    // The armour column: its rows' slot names in order.
    const slots = await panel.locator("ul").first().locator(":scope > li strong").evaluateAll((els) =>
      els.map((el) => el.firstChild?.textContent?.trim() ?? ""),
    );
    expect(slots.at(-2), slots.join(",")).toBe("무기");
    expect(slots.at(-1), slots.join(",")).toBe("완갑");
    // 보주 keeps its place under the equipment.
    await expect(panel.getByText("보주", { exact: true })).toBeVisible();
    await page.waitForTimeout(600);
    const { all, moved } = await shiftsSince(page);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

for (const width of [320, 1280])
  test(`내실 특수 장비에는 완갑·보주가 없다 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세", "collectibles"));
    const special = page.getByRole("region", { name: "특수 장비", exact: true });
    await expect(special).toBeVisible();
    await expect(special.getByText("완갑", { exact: true })).toHaveCount(0);
    await expect(special.getByText("보주", { exact: true })).toHaveCount(0);
    // The real special items (문장 and the rest) are still there.
    await expect(special.getByText("문장", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
