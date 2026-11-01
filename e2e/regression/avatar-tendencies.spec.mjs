// 회귀(사용자 11-02): 아바타 탭에 아바타마다 성향(지성·담력·매력·친절) 점수, 맨 위에 장착한 아바타의 성향 합계.
// 합계는 아바타 몫만이고 캐릭터 전체 성향(내실 탭)이 아님을 밝힌다. 성향이 없는 아바타(이동 효과)는 줄이 없다.
// 서버에서 함께 그려져 흔들림 0, 좁은 화면에서도 넘침 없음.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow, CONTRACT_FAILURE } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const panelOf = (page, title) =>
  // The innermost section with that heading (an outer wrapper section would hold every panel).
  page.locator("section", { has: page.getByRole("heading", { name: title, exact: true }) }).last();

for (const width of [1280, 360])
  test(`${width}: 아바타 성향 합계와 아바타별 성향 줄 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세", "avatars"));
    const totals = panelOf(page, "아바타 성향");
    await expect(totals).toBeVisible();
    // 지성·담력·매력·친절 in the game's order, the sums of the worn avatars in the mock.
    await expect(totals.locator("dt")).toHaveText(["지성", "담력", "매력", "친절"]);
    await expect(totals.locator("dd")).toHaveText(["+25", "+20", "+35", "+15"]);
    await expect(totals).toContainText("캐릭터 전체 성향은 내실 탭에 있어요.");

    const list = panelOf(page, "아바타 목록");
    const row = (name) => list.locator("li").filter({ hasText: name }).first();
    await expect(row("합성 하의 (패스)")).toContainText("담력 5 · 매력 15");
    await expect(row("합성 무기 아바타")).toContainText("지성 5 · 담력 5 · 매력 5 · 친절 5");
    // No 성향 line where the avatar gives none.
    await expect(row("합성 이동 효과").locator("small")).toHaveText(["이동 효과"]);
    // The panel sits above the list (first in the column).
    const order = await page.evaluate(() =>
      [...document.querySelectorAll("h2, h3")].map((h) => h.textContent?.trim()).filter((t) => t === "아바타 성향" || t === "아바타 목록"),
    );
    expect(order).toEqual(["아바타 성향", "아바타 목록"]);
    await page.waitForTimeout(500);
    const { all, moved } = await shiftsSince(page);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

// The api before #833 sends no tendencies field (PM-프론트 11-02): the tab draws as before, with no
// 성향 panel and no 성향 lines (never zeros), and the contract check does not fail.
test("성향 값이 없는 예전 응답: 아바타 탭은 그대로, 성향 칸·줄 없음 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("아바타옛응답", "avatars"));
  await expect(page.getByRole("heading", { name: "아바타 목록", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "아바타 효과", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "아바타 성향", exact: true })).toHaveCount(0);
  const list = panelOf(page, "아바타 목록");
  await expect(list.locator("li").filter({ hasText: "합성 하의 (패스)" }).first()).toBeVisible();
  await expect(list).not.toContainText(/(지성|담력|매력|친절) \d/);
  await expect(page.getByText(CONTRACT_FAILURE)).toHaveCount(0);
});
