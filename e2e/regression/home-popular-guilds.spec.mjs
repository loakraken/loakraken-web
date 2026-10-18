// v0.3.2(api #582 후속): 인기 길드는 길드 랭킹 화면 밖에서도 보인다 — 홈의 '인기 검색 캐릭터' 아래
// 카드(POPULAR_GUILDS만 따름). 첫 HTML에 들어 있어 첫 로드 흔들림 0.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360])
  test(`@인기길드 ${width} 홈에 인기 길드 카드, 첫 로드 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/");
    const card = page.getByRole("region", { name: /^인기 길드/ });
    await expect(card).toBeVisible();
    await expect(card.getByRole("list", { name: "인기 길드 순위" }).getByRole("listitem").first()).toBeVisible();
    await page.waitForTimeout(800);
    expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);
  });

// QA v0.3.1 P1-4 on the home card: a 7-day link opens on 7일, in the first HTML.
test("@인기길드 홈 카드의 기간도 주소에 남고, 7일 주소는 첫 로드 흔들림 0 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await gotoReady(page, "/");
  const card = page.getByRole("region", { name: /^인기 길드/ });
  await card.getByRole("group", { name: "인기 길드 기간" }).getByRole("button", { name: "7일" }).click();
  await expect(page).toHaveURL(/[?&]guildPeriod=7d(&|$)/);
  await watchShifts(page);
  await page.reload();
  await expect(card.getByRole("button", { name: "7일" })).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByRole("list", { name: "인기 길드 순위" }).getByRole("listitem")).toHaveCount(4);
  await page.waitForTimeout(800);
  expect((await shiftsSince(page)).all, "7일 주소 첫 로드 흔들림").toBe(0);
});