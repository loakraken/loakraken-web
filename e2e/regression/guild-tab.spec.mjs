// 회귀(L36·K28·M10 길드 탭): 길드가 있는 캐릭터에 길드 탭 — 확인한 길드원 수와 표본 안내,
// 아이템 레벨·전투력 평균·중앙값, 직업·분포, 길드원 목록(직위·이 캐릭터 강조). 기간 전환 흔들림 0,
// 길드원이 적으면 참고값 안내, 확인한 길드원이 없으면 안내.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

const GUILD = `${characterPath("상세")}?tab=guild`;

for (const width of [1280, 360])
  test(`@L36 ${width} 길드 탭: 표본 안내·요약·직업·길드원, 기간 전환 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    await page.getByRole("navigation", { name: "캐릭터 정보 탭" }).getByRole("link", { name: "길드", exact: true }).click();
    await expect(page).toHaveURL(/tab=guild/);
    await expect(page.getByRole("heading", { name: "합성길드" })).toBeVisible();
    const basis = page.getByRole("region", { name: "길드원 기준" });
    await expect(basis).toContainText("확인한 길드원 12명");
    await expect(basis).toContainText("최근 30일 안에 확인한 공개 길드원 12명 기준이에요(실제 길드 전체가 아니에요)");
    await expect(basis).not.toContainText("참고값");
    const members = page.getByRole("table", { name: /합성길드 길드원/ });
    await expect(members.locator("tbody tr")).toHaveCount(12);
    await expect(members.locator("tbody tr").first()).toContainText("길드장");
    await expect(members.locator("tbody tr[data-current]")).toContainText("상세");
    await expect(page.getByRole("list", { name: "직업별 길드원" }).getByRole("listitem")).toHaveCount(6);
    await page.waitForTimeout(600);
    expect((await shiftsSince(page)).all, "탭 열기 흔들림").toBe(0);

    for (const [days, count] of [["7일", 6], ["90일", 14], ["30일", 12]]) {
      const moved = await shiftsDuring(page, () => page.getByRole("group", { name: "최근 확인" }).getByRole("button", { name: days }).click());
      await expect(basis).toContainText(`확인한 길드원 ${count}명`);
      expect(moved.all, `${days} 전환 흔들림 (${moved.moved})`).toBe(0);
    }
    await expectNoHorizontalOverflow(page);
  });

test("@L36 길드원이 적으면 참고값 안내 @regression", async ({ page }) => {
  await page.route("**/api/guilds/**", (route) =>
    route.continue({ url: route.request().url().replace(encodeURIComponent("합성길드"), encodeURIComponent("작은길드")) }),
  );
  await gotoReady(page, GUILD);
  const basis = page.getByRole("region", { name: "길드원 기준" });
  await expect(basis).toContainText("확인한 길드원 3명");
  await expect(basis).toContainText("확인한 길드원이 5명 미만이라 참고값이에요.");
});

test("@L36 확인한 길드원이 없으면 안내 @regression", async ({ page }) => {
  await page.route("**/api/guilds/**", (route) =>
    route.continue({ url: route.request().url().replace(encodeURIComponent("합성길드"), encodeURIComponent("없는길드")) }),
  );
  await gotoReady(page, GUILD);
  await expect(page.getByText(/LOAKraken이 확인한 이 길드의 공개 길드원이 아직 없어요/)).toBeVisible();
});

test("@L36 길드가 없는 캐릭터는 길드 탭이 없음 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("모험가"));
  await expect(page.getByRole("navigation", { name: "캐릭터 정보 탭" }).getByRole("link", { name: "길드", exact: true })).toHaveCount(0);
});
