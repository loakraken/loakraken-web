// 회귀(사용자 의견 10-26): 완갑은 장비라 '전투' 탭 장비 목록에서 무기 바로 아래(#1098), 내실 탭 '특수 장비'에는
// 완갑·보주가 없다(#1102). 배치(사용자 10-31): 장신구 줄 아래에 어빌리티 스톤, 그 아래 보주, 팔찌는 두 줄 아래 한 줄
// 전체 폭. 휴대폰은 한 줄로 방어구 → 완갑 → 장신구 → 스톤 → 보주 → 팔찌. 첫 그림부터 같은 순서, 흔들림 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

// '전투력계산' carries the full gear set in the mock (완갑, 보주, an accessory with its ark passive point).
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [320, 360, 390, 1280])
  test(`완갑은 무기 바로 아래, 장신구 아래 스톤·보주, 팔찌는 아래 한 줄 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("전투력계산"));
    const panel = page.getByRole("region", { name: "장비", exact: true });
    // The armour column: its rows' slot names in order.
    const slots = await panel.locator("ul").first().locator(":scope > li strong").evaluateAll((els) =>
      els.map((el) => el.firstChild?.textContent?.trim() ?? ""),
    );
    expect(slots.at(-2), slots.join(",")).toBe("무기");
    expect(slots.at(-1), slots.join(",")).toBe("완갑");
    // Layout (user 10-31): the accessory column ends with the stone, then the
    // orb; the bracelet alone in the row under both columns, its full width.
    const layout = await panel.evaluate((el) => {
      const grid = el.querySelector("ul")?.parentElement?.parentElement;
      const column = grid?.children[1];
      const names = [...(column?.querySelector(":scope > ul")?.children ?? [])].map(
        (li) => li.querySelector("strong")?.firstChild?.textContent?.trim() ?? "",
      );
      const foot = grid?.nextElementSibling;
      const items = foot ? [...foot.children] : [];
      return {
        tail: names.slice(-2),
        foot: items.map((item) => item.querySelector("strong")?.textContent?.trim() ?? ""),
        footFull: items.length === 1 && Math.abs(items[0].getBoundingClientRect().width - foot.clientWidth) <= 1,
        footAfterGrid: !!foot && foot.getBoundingClientRect().top >= grid.getBoundingClientRect().bottom - 1,
      };
    });
    expect(layout).toEqual({ tail: ["어빌리티 스톤", "보주"], foot: ["팔찌"], footFull: true, footAfterGrid: true });
    await page.waitForTimeout(600);
    const { all, moved } = await shiftsSince(page);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

for (const width of [320, 1280])
  test(`내실 특수 장비에는 완갑·보주가 없다 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("전투력계산", "collectibles"));
    const special = page.getByRole("region", { name: "특수 장비", exact: true });
    await expect(special).toBeVisible();
    await expect(special.getByText("완갑", { exact: true })).toHaveCount(0);
    await expect(special.getByText("보주", { exact: true })).toHaveCount(0);
    // The real special items (문장 and the rest) are still there.
    await expect(special.getByText("문장", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

// #1099 (사용자 의견 10-26): 장신구 줄에는 아크 패시브 포인트 배지('+13')가 없다. 포인트는 아이템 툴팁에만 남는다.
test("장신구 줄에 아크 패시브 포인트 배지 없음, 툴팁에는 그대로 @1280 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("전투력계산"));
  const panel = page.getByRole("region", { name: "장비", exact: true });
  const necklace = panel.getByRole("listitem").filter({ has: page.locator("strong", { hasText: /^목걸이/ }) }).first();
  await expect(necklace).toBeVisible();
  await expect(necklace.getByLabel("깨달음 13")).toHaveCount(0);
  await expect(necklace).not.toContainText("+13");
  // The tooltip still carries the point.
  await necklace.getByRole("button").first().click();
  await expect(page.getByText("아크 패시브 포인트 효과")).toBeVisible();
  await expect(page.getByText("깨달음 +13")).toBeVisible();
});
