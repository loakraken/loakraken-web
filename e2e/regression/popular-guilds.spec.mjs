// 회귀(M21): 길드 랭킹 아래 '인기 길드' — 순위·길드·서버만(조회 수 없음), 24시간·7일, 랭킹의 서버를 따름,
// 집계 중이면 안내, 순위 기준 한 줄. 첫 로드와 기간 전환(누른 직후 포함) 흔들림 0, 360 넘침 없음.
import { test, expect, gotoReady, chooseOption, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360]) {
  test(`@M21 ${width} 인기 길드 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/rankings?type=guilds");
    const card = page.getByRole("region", { name: "인기 길드" });
    const list = card.getByRole("list", { name: "인기 길드 순위" });
    await expect(list.getByRole("listitem")).toHaveCount(10);
    await expect(list.getByRole("listitem").first()).toContainText("1인기길드1아만");
    await expect(card).toContainText("길드원 캐릭터 조회를 합한 순위");
    // No view counts in the card (the backend sends none).
    await expect(card).not.toContainText(/\d+회/);
    await page.waitForTimeout(600);
    expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);

    const period = card.getByRole("group", { name: "인기 길드 기간" });
    const moved = await shiftsDuring(page, () => period.getByRole("button", { name: "7일" }).click());
    await expect(list.getByRole("listitem")).toHaveCount(4);
    expect(moved.all, `기간 전환 흔들림 (${moved.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
}

test("@M21 인기 길드는 랭킹의 서버를 따르고, 집계 중이면 안내한다 @regression", async ({ page }) => {
  await gotoReady(page, "/rankings?type=guilds");
  const card = page.getByRole("region", { name: /인기 길드/ });
  await chooseOption(page, page.getByRole("combobox", { name: "서버" }), "카단");
  await expect(card.getByRole("heading")).toHaveText("인기 길드 · 카단");
  const rows = card.getByRole("list", { name: "인기 길드 순위" }).getByRole("listitem");
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("1인기길드2카단");
  await chooseOption(page, page.getByRole("combobox", { name: "서버" }), "니나브");
  await expect(card).toContainText("아직 순위를 집계하고 있어요.");
});
