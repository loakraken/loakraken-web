// 회귀(apple-design 재검수 · 랭킹·통계): 조건 알약과 쪽 이동 버튼은 휴대폰에서 44px로 눌리고
// (보이는 크기 그대로, 이웃 버튼을 잡지 않음), 누르면 바로 줄어드는 반응이 있다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** Each corner of a 44×44 box around the centre lands on the button itself. */
async function pressArea(button) {
  return button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    return [
      [-21, -21],
      [21, -21],
      [-21, 21],
      [21, 21],
    ].map(([dx, dy]) => {
      const hit = document.elementFromPoint(x + dx, y + dy);
      return hit === el || el.contains(hit);
    });
  });
}

test("랭킹·통계: 360에서 조건 알약·쪽 버튼 누르는 영역 44px @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoReady(page, "/rankings");
  const segment = page.getByRole("group", { name: "기준" }).getByRole("button");
  for (const i of [0, 1]) expect(await pressArea(segment.nth(i)), `기준 버튼 ${i + 1}`).toEqual([true, true, true, true]);
  const pager = page.getByRole("navigation", { name: "쪽 이동" }).getByRole("button");
  await pager.nth(2).scrollIntoViewIfNeeded();
  for (const i of [1, 2, 3]) expect(await pressArea(pager.nth(i)), `쪽 버튼 ${i + 1}`).toEqual([true, true, true, true]);
  // Visible pills keep their size.
  const box = await segment.first().boundingBox();
  expect(box.height).toBeLessThan(40);
});

test("랭킹·통계: 누르는 동안 알약이 줄어든다(레이아웃 그대로) @regression", async ({ page }) => {
  await gotoReady(page, "/rankings");
  const button = page.getByRole("group", { name: "기준" }).getByRole("button").nth(1);
  const box = await button.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
  const pressed = await button.boundingBox();
  expect(pressed.width).toBeLessThan(box.width);
  await page.mouse.up();
});
