// 회귀(apple-design 재검수 · 시세·경매): 휴대폰에서 시세판 기간·거래 조건·정렬·티어 버튼과
// 즐겨찾기 별은 44px로 눌리고 이웃을 잡지 않는다(데스크톱 모양은 그대로).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** Each corner of a 44×44 box around the centre lands on the control itself. */
const pressArea = (control) =>
  control.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
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

test("시세판: 360에서 기간·정렬·티어 버튼과 별 누르는 영역 44px @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoReady(page, "/market");
  for (const group of ["기간", "거래 조건", "정렬", "티어"]) {
    const buttons = page.getByRole("group", { name: group }).getByRole("button");
    const count = await buttons.count();
    for (let i = 0; i < count; i++) expect(await pressArea(buttons.nth(i)), `${group} ${i + 1}`).toEqual([true, true, true, true]);
  }
  expect(await pressArea(page.getByRole("button", { name: /^즐겨찾기/ }).first()), "즐겨찾기 별").toEqual([true, true, true, true]);
});

test("시세판: 데스크톱 버튼 크기는 그대로 @regression", async ({ page }) => {
  await gotoReady(page, "/market");
  const box = await page.getByRole("group", { name: "티어" }).getByRole("button").first().boundingBox();
  expect(box.width).toBeLessThan(44);
});
