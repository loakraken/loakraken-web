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
    await expect(panel.getByRole("link", { name: "관문 · 더보기는 숙제 체크에서" })).toHaveAttribute("href", "/tools/homework");
    await page.waitForTimeout(600);
    expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);

    // 닉네임 가리기 hides the names here too, without moving anything.
    const moved = await shiftsDuring(page, () => page.getByText("닉네임 가리기").click());
    await expect(rows.first()).not.toContainText("주간골드");
    expect(moved.all, `가리기 전환 흔들림 (${moved.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
}

// #14 (PM 총괄 11-08): gold and raids are chosen in the panel itself, and they are the
// homework tool's own saved choices (one saved state): both screens show the same.
// 320 too: the rows change their own content (shift tests at 320, #1088).
for (const width of [1280, 360, 320])
  test(`${width} 주간 획득 골드: 패널에서 레이드 · 골드 받기를 바꾸면 합계가 바뀌고 숙제 체크에도 같게, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("주간골드", "siblings"));
    const panel = page.getByRole("region", { name: "주간 획득 골드" });
    const total = panel.getByRole("definition").first();
    await expect(total).toHaveText("401,100G");
    // The rows are the list's own items (an open 레이드 고르기 has a list inside).
    const rows = panel.getByRole("list", { name: "캐릭터별 주간 골드" }).locator(":scope > li");
    const first = rows.first();
    await expect(first.locator(":scope > b")).toHaveText("166,000G");

    // One raid off: its gold leaves the row and the total.
    await first.getByText(/^레이드 고르기 \(3\)$/).click();
    const raids = first.getByRole("list", { name: /레이드$/ });
    const top = raids.getByRole("checkbox").first();
    const moved = await shiftsDuring(page, () => top.uncheck());
    await expect(first.getByText(/^레이드 고르기 \(2\)$/)).toBeVisible();
    await expect(total).not.toHaveText("401,100G");
    const lowered = await total.innerText();
    expect(moved.all, `레이드 끄기 흔들림 (${moved.moved})`).toBe(0);

    // Gold off for the second character: its row reads 0G, nothing moves.
    const second = rows.nth(1);
    const off = await shiftsDuring(page, () => second.getByRole("switch").uncheck());
    await expect(second.locator(":scope > b")).toHaveText("0G");
    // Exactly the amount (copy and screen readers): no holding characters (codex P2).
    expect(await second.locator(":scope > b").innerText()).toBe("0G");
    expect(await first.locator(":scope > b").innerText()).toBe("166,000G");
    await expect(total).not.toHaveText(lowered);
    expect(off.all, `골드 받기 끄기 흔들림 (${off.moved})`).toBe(0);

    // The homework tool shows the same saved choices.
    await gotoReady(page, "/tools/homework");
    const card = page.getByRole("region", { name: "주간골드 숙제" });
    await expect(card).toBeVisible();
    // Two raids left (the gate lists, one per raid: role group named by the raid).
    await expect(card.locator('ul[role="group"]')).toHaveCount(2);
    const secondName = (await page.getByRole("region", { name: / 숙제$/ }).nth(1).getByRole("heading").innerText()).trim();
    expect(secondName.length).toBeGreaterThan(0);
    await expect(page.getByRole("region", { name: `${secondName} 숙제` }).getByRole("switch")).not.toBeChecked();
  });
