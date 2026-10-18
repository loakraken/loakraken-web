// 크라켄 점수(backend #561) 배너 표시: 점수·티어·티어 안 진행 막대·다음 티어까지 남은 점수(정수).
// 최고 티어는 막대가 꽉 차고 '최고 티어', 계산 못 함은 '준비 중'(같은 크기), 공개 전·없음은 항목 자체가 없다.
// 첫 로드 흔들림 0, 360에서도 한 줄(말줄임 없음).
import { test, expect, gotoReady, characterPath } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const item = (page) => page.locator("dl > div").filter({ has: page.locator("dt", { hasText: "크라켄 점수" }) });
const barWidth = (page) =>
  item(page).evaluate((el) => {
    const track = el.querySelector("dd > span[aria-hidden]");
    return Math.round((track.firstElementChild.getBoundingClientRect().width / track.getBoundingClientRect().width) * 100);
  });

for (const width of [1280, 360]) {
  test(`@크라켄점수 ${width} 점수·티어·진행·다음 티어까지, 첫 로드 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    const box = item(page);
    await expect(box).toBeVisible();
    await expect(box.locator("dd")).toContainText("5,658.62");
    await expect(box.locator("dd")).toContainText("다이아");
    await expect(box.locator("dd")).toContainText("마스터 티어까지 1,042점");
    expect(await barWidth(page), "티어 안 38%").toBe(38);
    // Read as one sentence with its progress, the bar itself hidden.
    await expect(box.locator("dd")).toContainText("다이아 티어 38% 진행");
    await page.waitForTimeout(800);
    expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);
    // One line each, nothing cut (A37), inside the banner.
    const fits = await box.evaluate((el) =>
      [...el.querySelectorAll("dd > span, dd > small")].every((n) => n.scrollWidth <= n.clientWidth + 1 && n.getClientRects().length === 1),
    );
    expect(fits, "한 줄, 잘림 없음").toBe(true);
  });

  test(`@크라켄점수 ${width} '준비 중'은 같은 크기, 최고 티어는 막대 꽉 참 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세"));
    const ready = await item(page).boundingBox();
    await gotoReady(page, characterPath("크라켄준비중"));
    await expect(item(page).locator("dd")).toContainText("준비 중");
    await expect(item(page).locator("dd")).not.toContainText("점");
    const pending = await item(page).boundingBox();
    expect(Math.round(pending.height), "'준비 중' 높이 = 점수 있을 때").toBe(Math.round(ready.height));
    await gotoReady(page, characterPath("크라켄에스더"));
    await expect(item(page).locator("dd")).toContainText("10,183.94");
    await expect(item(page).locator("dd")).toContainText("에스더");
    await expect(item(page).locator("dd")).toContainText("최고 티어");
    expect(await barWidth(page), "최고 티어 막대").toBe(100);
  });
}

test("@크라켄점수 공개 전(DISABLED)이나 점수가 없는 응답은 항목이 없다 @regression", async ({ page }) => {
  for (const name of ["크라켄꺼짐", "전투력계산"]) {
    await gotoReady(page, characterPath(name));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(item(page)).toHaveCount(0);
  }
});
