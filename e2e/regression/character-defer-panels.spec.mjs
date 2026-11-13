// 회귀(/character TBT P2, PM 총괄 11-13 (a)): 두 줄 배치(901px 이상)에서 첫 화면 아래 무거운 패널(보석·아크
// 그리드·카드·순위·조회수)은 가까워질 때까지 배치·그리기를 건너뛴다(content-visibility: auto). 한 줄 배치(휴대폰)는
// 건너뛰지 않는다(#1590: 바로 가기가 그리지 않은 패널 바로 아래에 떨어져 화면이 움직였음). 사용자가 보는 것은
// 같아야 한다: 스크롤해도 흔들림 0, 페이지 찾기로 건너뛴 패널 안 글자를 찾고, 깊은 패널로 바로 가도 그 자리.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const DEFERRED = ["보석", "아크 그리드", "카드", "순위", "조회수"];

for (const width of [320, 360, 390, 1280])
  test(`${width}: ${width > 900 ? "아래 패널은 건너뛰고" : "한 줄 배치는 건너뛰지 않고"}, 끝까지 스크롤해도 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세", "combat"));
    for (const name of DEFERRED) {
      const panel = page.getByRole("region", { name, exact: true });
      await expect(panel, name).toHaveCSS("content-visibility", width > 900 ? "auto" : "visible");
    }
    await page.waitForTimeout(500);
    const mark = await shiftMark(page);
    // Down to the end in screen-sized steps, letting each step settle, then back up.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 600) {
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(150);
    }
    for (let y = 0; y < height; y += 600) {
      await page.mouse.wheel(0, -600);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(300);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `스크롤 중 흔들림 (${moved})`).toBe(0);
  });

test("1280: 건너뛴 패널 안 글자도 찾기로 찾고, 그 자리로 간다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoReady(page, characterPath("상세", "combat"));
  const cards = page.getByRole("region", { name: "카드", exact: true });
  // Not drawn yet: below the first screen.
  await expect(cards).toHaveCSS("content-visibility", "auto");
  expect((await cards.boundingBox()).y).toBeGreaterThan(1000);
  // window.find runs the browser's find on the page (Ctrl+F's engine); skipped content is searchable.
  const found = await page.evaluate(() => window.find("각성 합"));
  expect(found, "건너뛴 카드 패널의 '각성 합'을 찾지 못함").toBe(true);
  const box = await cards.boundingBox();
  expect(box.y + box.height, "찾은 패널이 화면에 없음").toBeGreaterThan(0);
  expect(box.y).toBeLessThan(800);
});

for (const width of [360, 1280])
  test(`${width}: 깊은 패널로 바로 가도 그 자리에 머물고, 위로 올려도 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세", "combat"));
    // 1280: 카드 (조회수 is too near the page's end there for its top to reach the target).
    const views = page.getByRole("region", { name: width > 900 ? "카드" : "조회수", exact: true });
    // As an in-page link would: straight to the panel, past panels never drawn.
    await views.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(500);
    const first = (await views.boundingBox()).y;
    await page.waitForTimeout(500);
    const later = (await views.boundingBox()).y;
    expect(Math.abs(later - first), `패널이 ${first} → ${later}로 움직임`).toBeLessThanOrEqual(1);
    // And where it should be: its top at the jump's target (the top edge, after any scroll-padding),
    // not merely somewhere stable (codex 11-13: a wrong-but-stable landing must fail).
    const target = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
    expect(Math.abs(later - target), `패널 위 끝 ${later}, 가야 할 곳 ${target}`).toBeLessThanOrEqual(2);
    const mark = await shiftMark(page);
    for (let i = 0; i < 12; i += 1) {
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(300);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `위로 올리는 중 흔들림 (${moved})`).toBe(0);
  });
