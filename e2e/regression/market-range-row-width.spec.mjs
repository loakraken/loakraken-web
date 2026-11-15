// 회귀 가드(#1661 검토 P3): 시세 추이 · 최저가 추이의 기간 줄은 첫 HTML이 줄의 시작 태그 뒤에서 끊겨도(단추 0개)
// 이미 최종 폭이어야 한다(#1657: 줄 폭을 단추 글자 수로 계산). 끊어 보는 검사(market-cell-trend-first-paint)는
// 줄을 그리지 않는 겹(data-fp-whole)과 함께라서 폭 계산만 빠져도 통과했다. 여기서는 단추를 모두 뺀 줄의 폭을
// 바로 잰다: 폭 계산이 빠지면 0에 가까워져 실패한다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const PAGES = [
  ["시세 추이(시세)", "/market"],
  ["최저가 추이(보석 칸)", "/market/gems?kind=겁화&level=10"],
];

/** The row's width as drawn, and the width of the same row with no button in it (its start tag alone). */
const widths = (page) =>
  page.getByRole("group", { name: "기간" }).evaluate((row) => {
    const drawn = row.getBoundingClientRect().width;
    // A shallow copy keeps the row's own attributes (class, style, data-fp-whole) and none of its buttons. It
    // stands in the row's place for one synchronous measure; no frame is painted and React never sees it.
    const empty = row.cloneNode(false);
    row.replaceWith(empty);
    const bare = empty.getBoundingClientRect().width;
    empty.replaceWith(row);
    return { drawn, bare, buttons: row.querySelectorAll("button").length };
  });

const check = async (page, url) => {
  await gotoReady(page, url);
  await expect(page.getByRole("group", { name: "기간" })).toHaveCount(1);
  const { drawn, bare, buttons } = await widths(page);
  expect(buttons, "단추 수").toBeGreaterThanOrEqual(4);
  expect(Math.abs(bare - drawn), `단추 없는 줄 ${bare}px · 그려진 줄 ${drawn}px`).toBeLessThan(0.5);
};

for (const width of [1280, 360])
  for (const [label, url] of PAGES)
    test(`${width} ${label}: 기간 줄은 단추가 하나도 없을 때 이미 최종 폭 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await check(page, url);
    });

test.describe("터치 태블릿(굵은 포인터, 단추 44px)", () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });
  for (const [label, url] of PAGES)
    test(`768 터치 ${label}: 기간 줄은 단추가 하나도 없을 때 이미 최종 폭 @regression`, async ({ page }) => {
      await gotoReady(page, url);
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), "굵은 포인터").toBe(true);
      await check(page, url);
    });
});
