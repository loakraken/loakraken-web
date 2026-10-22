// 회귀(체크리스트 L34): 스킬 탭에서 스킬 목록에 없는 스킬(아이덴티티 등)에 낀 보석은
// 목록 아래 '그 외 장착 보석' 줄에 레벨·종류·스킬 이름으로 보이고, 보석 필터와 상관없이 남는다.
// 그런 보석이 없으면 줄도 없다. 첫 로드 흔들림 0, 360에서 넘침 없음.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360]) {
  test(`@L34 ${width} 그 외 장착 보석 줄 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("그외보석", "skills"));
    const other = page.getByRole("list", { name: "그 외 장착 보석" });
    await expect(other).toBeVisible();
    await expect(other.getByRole("listitem")).toHaveCount(1);
    await expect(other.getByRole("listitem")).toContainText("10작");
    await expect(other.getByRole("listitem")).toContainText("테스트 아이덴티티");
    // The listed skill keeps its own gem on its row, not in this line.
    await expect(other).not.toContainText("스킬명");
    await page.waitForTimeout(600);
    expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);

    // Filters narrow the skill rows only.
    await page.getByRole("group", { name: "보석으로 거르기" }).getByRole("button", { name: /^미장착/ }).click();
    await expect(other).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test("@L34 그 외 보석이 없으면 줄이 없다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "skills"));
  await expect(page.getByRole("group", { name: "보석으로 거르기" })).toBeVisible();
  await expect(page.getByRole("list", { name: "그 외 장착 보석" })).toHaveCount(0);
});
