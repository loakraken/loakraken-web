// 회귀(마케팅 실서비스 390): 캐릭터 탭 줄이 휴대폰에서 옆으로 스크롤될 때, 고른 탭이 줄 끝 흐림에 잘려
// '스펙ㅇ'처럼 보였다('더보기' 앞의 0처럼 읽힘). 고른 탭의 글자는 늘 흐림 밖에 다 보인다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

for (const width of [320, 360, 390])
  for (const tab of ["specup", "siblings", "evidence"])
    test(`고른 탭이 탭 줄 안에 다 보인다 ${tab} @${width} @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(characterPath("상세", tab));
      const nav = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
      const current = nav.locator('a[aria-current="page"]');
      await expect(current).toBeVisible();
      await expect
        .poll(() =>
          current.evaluate((a) => {
            const row = a.closest("nav");
            const box = row.getBoundingClientRect();
            // The label itself (text and 베타 chip), not the pill's padding: the
            // padding may sit under a fade on the narrowest row, the words never.
            const range = document.createRange();
            range.selectNodeContents(a);
            const r = range.getBoundingClientRect();
            const fade = Math.min(row.clientWidth * 0.12, 40);
            // No fade at an end the row is scrolled all the way to.
            const startFade = row.scrollLeft > 0 ? fade : 0;
            const endFade = row.scrollLeft + row.clientWidth < row.scrollWidth - 1 ? fade : 0;
            return {
              cutStart: Math.max(0, Math.round(box.left + startFade - r.left)),
              cutEnd: Math.max(0, Math.round(r.right - (box.right - endFade))),
            };
          }),
        )
        .toEqual({ cutStart: 0, cutEnd: 0 });
    });

// Anything that resizes the tab row after load (a late font, the refresh label
// turning into a countdown, a narrower window) must not pull a hand-scrolled
// row back to the current tab: on a phone the click on 스킬 landed after the
// row jumped and missed (CI mobile-390, #1077).
test("손으로 넘긴 탭 줄은 탭 줄 크기가 바뀌어도 되돌아가지 않고, 넘긴 탭을 누를 수 있다 @390 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(characterPath("상세"));
  const nav = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
  await expect(nav.locator('a[aria-current="page"]')).toBeVisible();
  await page.waitForTimeout(800);
  const end = await nav.evaluate((row) => {
    row.scrollLeft = row.scrollWidth;
    return row.scrollLeft;
  });
  expect(end).toBeGreaterThan(0);
  // The row resizes (as after a late font or label change).
  await page.setViewportSize({ width: 386, height: 844 });
  await page.waitForTimeout(400);
  expect(await nav.evaluate((row) => row.scrollLeft)).toBeGreaterThan(end / 2);
  await nav.getByRole("link", { name: "스킬", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=skills$/);
});