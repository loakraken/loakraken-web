// 회귀(사용자 의견 10-22): /schedule 카오스게이트는 지역 13곳이 회차·보상이 같으면 한 줄('카오스게이트 · 13곳'),
// 지역과 입장 레벨은 자세히에만. 카게·필보 줄에는 'N 이상'이 없다. 날짜 아래 '오늘: 카오스게이트'처럼 그날 종류.
// 첫 로드·지난 회차 숨김 흔들림 0, 넘침 없음 (320·360·390·1280, 밝게·어둡게).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

/** A day button in the week strip whose date is even (chaos gates in the mock) or odd (field bosses). */
async function pickDay(page, even) {
  const days = page.getByRole("group", { name: "요일 선택" }).getByRole("button");
  const count = await days.count();
  for (let i = 0; i < count; i++) {
    const day = Number(await days.nth(i).locator("b").innerText());
    if ((day % 2 === 0) === even) {
      await days.nth(i).click();
      // The board shows that day only once its answer is in (the strip marks it then).
      await expect(days.nth(i)).toHaveAttribute("aria-pressed", "true");
      return { day, today: (await days.nth(i).getAttribute("data-today")) !== null };
    }
  }
  throw new Error("no such day in the week");
}

for (const scheme of ["light", "dark"])
  for (const width of [320, 360, 390, 1280])
    test(`@일정카게 ${scheme} ${width} 카오스게이트 한 줄·자세히에 지역, 필보 레벨 줄 없음 @regression`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, "/schedule");
      const line = page.locator("p", { hasText: /^(오늘|이 날): / });
      await expect(line).toHaveCount(1);
      // Every day of the strip gets its dot (chaos gates on even dates in the mock), named for screen readers.
      const days = page.getByRole("group", { name: "요일 선택" }).getByRole("button");
      for (let i = 0; i < 7; i++) {
        const even = Number(await days.nth(i).locator("b").innerText()) % 2 === 0;
        await expect(days.nth(i).locator("[data-kind]")).toHaveAttribute("data-kind", even ? "chaos-gate" : "field-boss");
        await expect(days.nth(i)).toHaveAttribute("aria-label", even ? /, 카오스게이트/ : /, 필드 보스/);
      }
      await page.waitForTimeout(600);
      const loaded = await shiftsSince(page);
      expect(loaded.all, `첫 로드 흔들림 (${loaded.moved})`).toBe(0);

      // A chaos gate day: one row for 13 places, no level line.
      const gateDay = await pickDay(page, true);
      await expect(line).toHaveText(`${gateDay.today ? "오늘" : "이 날"}: 카오스게이트 · 필드 보스 없음`);
      const gates = page.getByRole("region", { name: "카오스게이트", exact: true });
      await expect(gates.getByRole("listitem").filter({ has: page.locator("strong") })).toHaveCount(1);
      await expect(gates.locator("strong").first()).toHaveText("카오스게이트");
      await expect(gates.getByText("13곳", { exact: true })).toBeVisible();
      await expect(gates).not.toContainText("1,580 이상");
      await expect(gates).not.toContainText("일렁이는 악마군단");
      await gates.getByRole("button", { name: /^카오스게이트 보상/ }).click();
      const places = gates.getByRole("region", { name: "지역" });
      await expect(places.getByRole("heading")).toHaveText("지역 13곳");
      await expect(places.getByRole("listitem")).toHaveCount(13);
      await expect(places.getByRole("listitem").first()).toHaveText(/일렁이는 악마군단\s*1,580 이상/);
      await expectNoHorizontalOverflow(page);

      // The hide-past toggle moves nothing.
      const mark = await shiftMark(page);
      await page.getByRole("button", { name: "지난 회차 숨김" }).click();
      await page.waitForTimeout(700);
      const toggled = await shiftsSince(page, mark);
      expect(toggled.all, `지난 회차 숨김 흔들림 (${toggled.moved})`).toBe(0);

      // A field boss day: the boss keeps its name, its level only in 자세히.
      const bossDay = await pickDay(page, false);
      await expect(line).toHaveText(`${bossDay.today ? "오늘" : "이 날"}: 카오스게이트 없음 · 필드 보스`);
      const bosses = page.getByRole("region", { name: "필드 보스", exact: true });
      await expect(bosses.locator("strong").first()).toHaveText("세베크 아툰");
      await expect(bosses).not.toContainText("1,460 이상");
      await bosses.getByRole("button", { name: /^세베크 아툰 보상/ }).click();
      await expect(bosses.getByRole("region", { name: "입장" })).toHaveText("입장 1,460 이상");
      await expectNoHorizontalOverflow(page);
    });
