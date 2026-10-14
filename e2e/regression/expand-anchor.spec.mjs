// 회귀(A7 펼침 기준, PM-프론트 10-14): 사용자가 연 펼침 아래가 누른 직후 한 번 내려가는 것은 흔들림이 아니다.
// 대신 ① 누른 버튼은 제자리(세로 ±1px) ② 펼친 내용은 버튼 바로 아래에서 열림 ③ 늦게 오는 이동 없음.
// 홈·일정의 보상 '+N'과 '기타 일정'을 1280·360에서 연다(#813).
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

/** The control's top in page coordinates (scrolling on click must not count as moving). */
const top = (locator) => locator.evaluate((el) => el.getBoundingClientRect().top + scrollY);

async function opensInPlace(page, control, panelOf) {
  await control.scrollIntoViewIfNeeded();
  const before = await top(control);
  await control.click();
  const panel = panelOf();
  await expect(panel).toBeVisible();
  // Let the opening settle, then nothing more may move.
  await page.waitForTimeout(300);
  const mark = await shiftMark(page);
  expect(Math.abs((await top(control)) - before), "누른 버튼 제자리(±1px)").toBeLessThanOrEqual(1);
  const [controlBox, panelBox] = await Promise.all([control.boundingBox(), panel.boundingBox()]);
  expect(panelBox.y, "펼친 내용이 버튼 아래에서 열림").toBeGreaterThanOrEqual(controlBox.y + controlBox.height - 1);
  await page.waitForTimeout(1200);
  const late = await shiftsSince(page, mark);
  expect(late.all, `늦게 오는 이동 (${late.moved})`).toBe(0);
}

for (const path of ["/", "/schedule"])
  for (const width of [1280, 360])
    test(`@A7 ${path} 보상 +N 펼침: 버튼 제자리·바로 아래·늦은 이동 0 @${width} @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, path);
      const first = page.getByRole("button", { name: /보상 \d+개 더 보기$/ }).first();
      await expect(first).toBeVisible();
      // Held by the panel it controls: once open its name reads "접기", and a
      // name-based locator would move on to the next row's button.
      const panelId = await first.getAttribute("aria-controls");
      const more = page.locator(`button[aria-controls="${panelId}"]`);
      await opensInPlace(page, more, () => page.locator(`[id="${panelId}"]`));
      await expect(more).toHaveAttribute("aria-expanded", "true");
    });

for (const width of [1280, 360])
  test(`@A7 /schedule 기타 일정 펼침: 제목 제자리·바로 아래·늦은 이동 0 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/schedule");
    const others = page.locator("summary", { hasText: "기타 일정" });
    test.skip(!(await others.count()), "오늘 기타 일정 없음");
    await opensInPlace(page, others, () => others.locator("xpath=..").getByRole("region", { name: "기타 일정" }));
  });
