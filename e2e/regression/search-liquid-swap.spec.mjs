// 회귀(PM 총괄 11-08, 안 b): 헤더 검색은 같은 모양의 평범한 입력칸으로 바로 열리고, 물방울(liquid) 면은
// 연 뒤 한가할 때(또는 첫 글자 뒤) 그 아래에 들어온다. 바뀌는 순간 칸 크기·위치·초점·글자·커서가 그대로이고
// 흔들림 0이다. 넓은 화면·휴대폰 모두.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 390])
  test(`검색 칸: 평범한 칸 → 물방울 면, 아무것도 움직이지 않음 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market");
    await page.getByRole("button", { name: "캐릭터 검색" }).first().click();
    const box = page.getByRole("combobox", { name: "캐릭터 이름" });
    await expect(box).toBeFocused();
    const field = page.locator(".cmd-field");
    // Plain first: the field's own pill, no liquid surface yet.
    await expect(field).not.toHaveAttribute("data-liquid");
    await expect(page.locator(".cmd-liquid")).toHaveCount(0);
    const rect = async () =>
      page.locator(".cmd").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height].map(Math.round);
      });
    // Type before the swap: the text and the caret must survive it.
    await page.keyboard.type("상세");
    const before = await rect();
    // A few pixels inside the bar's right end (no text there): the pill's fill.
    const spot = { x: before[0] + before[2] - 40, y: before[1] + 24, width: 6, height: 6 };
    const plainFill = await page.screenshot({ clip: spot, animations: "disabled" });
    const mark = await shiftMark(page);
    await expect(field).toHaveAttribute("data-liquid", "true", { timeout: 5000 });
    await expect(page.locator(".cmd-liquid")).toHaveCount(1);
    await page.waitForTimeout(400);
    expect(await rect(), "검색 칸 크기·위치").toEqual(before);
    // The liquid body really is the bar's size under it (else the pill would vanish).
    const shape = await page.locator(".cmd-liquid .cmd-shape").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map(Math.round);
    });
    expect(shape, "물방울 면 = 검색 칸").toEqual(before);
    // And it paints: the same fill as the plain pill, not the backdrop through it.
    expect(Buffer.compare(await page.screenshot({ clip: spot, animations: "disabled" }), plainFill), "물방울 면의 칠 = 평범한 칸의 칠").toBe(0);
    await expect(box).toBeFocused();
    await expect(box).toHaveValue("상세");
    expect(await box.evaluate((el) => [el.selectionStart, el.selectionEnd])).toEqual([2, 2]);
    const moved = await shiftsSince(page, mark);
    expect(moved.all, `물방울 면이 들어올 때 흔들림 (${moved.moved})`).toBe(0);
    // The liquid surface takes no focus and no click.
    await expect(page.locator(".cmd-liquid")).toHaveAttribute("aria-hidden", "true");
    expect(await page.locator(".cmd-liquid").evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  });

test("검색 칸: 닫고 다시 열면 또 평범한 칸부터 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market");
  const open = page.getByRole("button", { name: "캐릭터 검색" }).first();
  await open.click();
  await expect(page.locator(".cmd-field")).toHaveAttribute("data-liquid", "true", { timeout: 5000 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: "캐릭터 이름" })).toHaveCount(0);
  // Record the field as it is put in the page: plain, the liquid comes only at idle.
  await page.evaluate(() => {
    window.__firstField = null;
    new MutationObserver((_, observer) => {
      const field = document.querySelector(".cmd-field");
      if (!field) return;
      window.__firstField = { liquid: field.hasAttribute("data-liquid"), surface: !!document.querySelector(".cmd-liquid") };
      observer.disconnect();
    }).observe(document.body, { childList: true, subtree: true });
  });
  await open.click();
  await expect.poll(() => page.evaluate(() => window.__firstField)).toEqual({ liquid: false, surface: false });
  await expect(page.locator(".cmd-field")).toHaveAttribute("data-liquid", "true", { timeout: 5000 });
});
