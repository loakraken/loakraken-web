// A7 (PM-프론트 11-22, found by 프론트2 measuring #1955): /tools/refining?character=X loads the character with no input.
// When the answer arrived, the 캐릭터 장비 card grew by its 'loaded' line (and the note on parts it could not read) and
// pushed the 목표 단계 card 40px down. The answer is held here until the page is measured; the card keeps its height and
// nothing below it moves. Mock '재련': 어깨 is not 업화·전율, so the case with a part left out is the one measured.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [320, 1280])
  test(`${width}: 주소로 캐릭터를 불러와도 캐릭터 장비 카드 높이와 아래 카드 자리가 그대로다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route("**/api/characters?*", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(`/tools/refining?character=${encodeURIComponent("재련")}`);
    const loader = page.locator("section", { has: page.getByRole("heading", { name: "캐릭터 장비" }) });
    const target = page.locator("section", { has: page.getByRole("heading", { name: "목표 단계" }) });
    await expect(page.getByRole("button", { name: "불러오는 중…" })).toBeVisible();
    const box = async () => {
      const [a, b] = await Promise.all([loader.boundingBox(), target.boundingBox()]);
      return { loaderHeight: Math.round(a.height * 10) / 10, targetY: Math.round(b.y * 10) / 10 };
    };
    // Settled before the answer (fonts, first paint): what moves from here is the character.
    await page.waitForTimeout(600);
    const before = await box();
    const mark = await shiftMark(page);

    release();
    await expect(page.getByText(/재련 · 루페온 · 아이템 레벨 1,738\.33/)).toBeVisible();
    await expect(page.getByRole("group", { name: "무기" }).getByRole("combobox", { name: "현재" })).toHaveText("+21");
    await page.waitForTimeout(400);
    const after = await box();
    expect(after.loaderHeight, `캐릭터 장비 카드 높이 ${before.loaderHeight} → ${after.loaderHeight}`).toBe(before.loaderHeight);
    expect(after.targetY, `목표 단계 카드 자리 ${before.targetY} → ${after.targetY}`).toBe(before.targetY);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
