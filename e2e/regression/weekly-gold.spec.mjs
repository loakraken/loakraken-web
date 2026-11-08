// 회귀(체크리스트 M7·L20·K26): 원정대 탭 '주간 획득 골드' — 지금 캐릭터 서버의 아이템 레벨 상위
// 6캐릭터, 캐릭터마다 골드가 가장 많은 레이드 3개(숙제 도구 자동 구성과 같은 계산).
// 다른 서버 캐릭터는 세지 않고, 닉네임 가리기를 따르며, 첫 로드·가리기 전환 때 흔들림 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360]) {
  test(`@M7 ${width} 원정대 주간 획득 골드 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("주간골드", "siblings"));
    const panel = page.getByRole("region", { name: "주간 획득 골드" });
    await expect(panel).toContainText("아만 상위 6캐릭터");
    // 1770 166,000 · 1725 110,000 · 1705 84,000 · 1585 14,600 · 1580 14,600 · 1560 11,900.
    await expect(panel.getByRole("definition")).toHaveText(["401,100G", "197,000G", "204,100G"]);
    const rows = panel.getByRole("list", { name: "캐릭터별 주간 골드" }).getByRole("listitem");
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toContainText("주간골드");
    await expect(rows.first()).toContainText("166,000G");
    await expect(rows.nth(1)).toContainText("110,000G");
    await expect(rows.nth(2)).toContainText("84,000G");
    await expect(panel).not.toContainText("주간골드일곱");
    await expect(panel).not.toContainText("주간골드다른서버");
    await expect(panel.getByRole("link", { name: "숙제에서 레이드 고르기" })).toHaveAttribute(
      "href",
      `/tools/homework?character=${encodeURIComponent("주간골드")}`,
    );
    await page.waitForTimeout(600);
    expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);

    // 닉네임 가리기 hides the names here too, without moving anything.
    const moved = await shiftsDuring(page, () => page.getByText("닉네임 가리기").click());
    await expect(rows.first()).not.toContainText("주간골드");
    expect(moved.all, `가리기 전환 흔들림 (${moved.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
}

// #14 (PM 총괄 11-08, 안 1): the raids are chosen in the homework tool, for this roster.
// The link opens it with the roster's list ready (top six ticked); nothing is added
// until '추가', and the address drops ?character so a reload does not ask again.
test("주간 획득 골드 → 숙제에서 레이드 고르기: 이 원정대 목록이 준비되고, 누르기 전엔 추가하지 않는다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, characterPath("주간골드", "siblings"));
  // The homework page's own request (the character page may ask for siblings too).
  const asked = page.waitForRequest((r) => r.url().includes("/api/characters/siblings") && page.url().includes("/tools/homework"));
  await page.getByRole("region", { name: "주간 획득 골드" }).getByRole("link", { name: "숙제에서 레이드 고르기" }).click();
  await expect(page).toHaveURL(/\/tools\/homework$/);
  expect(new URL((await asked).url()).searchParams.toString()).toContain(encodeURIComponent("주간골드"));
  await expect(page.getByRole("textbox", { name: "캐릭터 이름" })).toHaveValue("주간골드");
  const pick = page.getByRole("group", { name: "숙제에 넣을 캐릭터" });
  await expect(pick.getByRole("checkbox", { checked: true })).toHaveCount(6);
  await expect(page.getByRole("button", { name: "6명 추가" })).toBeVisible();
  // Not added yet: the empty-state line is still there.
  await expect(page.getByText(/캐릭터 이름을 넣으면 원정대를 불러와요/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "캐릭터 이름" })).toHaveValue("");
  await expect(page.getByRole("group", { name: "숙제에 넣을 캐릭터" })).toHaveCount(0);
});
