// 회귀(사용자 의견 10-22): /schedule 카오스게이트는 지역 13곳이 회차·보상이 같으면 한 줄('카오스게이트 · 13곳'),
// 줄에는 입장 레벨('N 이상')과 맨 아래 '지역 13곳'(#1096), 지역 목록은 자세히. 날짜 아래 '오늘: 카오스게이트'처럼 그날 종류.
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
    test(`@일정카게 ${scheme} ${width} 카오스게이트 한 줄·줄 끝에 지역, 레벨은 줄 안에 @regression`, async ({ page }) => {
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

      // A chaos gate day: one row for 13 places, its level on the row, the places last.
      const gateDay = await pickDay(page, true);
      await expect(line).toHaveText(`${gateDay.today ? "오늘" : "이 날"}: 카오스게이트 · 필드 보스 없음`);
      const gates = page.getByRole("region", { name: "카오스게이트", exact: true });
      await expect(gates.getByRole("listitem").filter({ has: page.locator("strong") })).toHaveCount(1);
      await expect(gates.locator("strong").first()).toHaveText("카오스게이트");
      await expect(gates.getByText("지역 13곳", { exact: true })).toBeVisible();
      await expect(gates.locator("strong + small").first()).toHaveText("1,580 이상");
      await expect(gates).not.toContainText("일렁이는 악마군단");
      // User 11-02: the official 골드·귀속 골드 lead the row's rewards (grade 일반, they fell behind '+N' before).
      const rowRewards = gates.getByRole("list", { name: "카오스게이트 보상" }).getByRole("listitem");
      await expect(rowRewards.nth(0)).toHaveText("골드(일반)");
      await expect(rowRewards.nth(1)).toHaveText("귀속 골드(일반)");
      await gates.getByRole("button", { name: /^카오스게이트 보상/ }).click();
      // Level groups high → low, each led by 골드·귀속 골드; no gold amount anywhere (user 11-02).
      const groups = gates.getByRole("region", { name: /^[\d,]+ 이상$/ });
      await expect(groups).toHaveCount(10);
      await expect(groups.first().getByRole("heading")).toHaveText("1,770 이상");
      await expect(groups.last().getByRole("heading")).toHaveText("1,580 이상");
      await expect(gates.getByRole("region", { name: "1,720 이상" }).getByRole("listitem").first()).toHaveText("골드(일반)");
      // Every gold item is the official name alone: no amount on the row or in any group.
      // Reward items only (RewardItem sets a title); the row's own <li> holds all of them.
      const golds = await gates.locator("li[title]").filter({ hasText: "골드" }).allTextContents();
      expect(golds.length).toBe(22);
      for (const gold of golds) expect(gold.trim()).toMatch(/^(귀속 )?골드\(일반\)$/);
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

      // A field boss day: the boss keeps its name and shows its level; two rewards fit, so no 자세히.
      const bossDay = await pickDay(page, false);
      await expect(line).toHaveText(`${bossDay.today ? "오늘" : "이 날"}: 카오스게이트 없음 · 필드 보스`);
      // The week lists every chaos gate with no rounds today: no row for them, only the line above.
      await expect(page.getByRole("region", { name: "카오스게이트", exact: true })).toHaveCount(0);
      const bosses = page.getByRole("region", { name: "필드 보스", exact: true });
      await expect(bosses.locator("strong").first()).toHaveText("세베크 아툰");
      await expect(bosses.locator("strong + small").first()).toHaveText("1,460 이상");
      await expect(bosses.getByRole("button", { name: /^세베크 아툰 보상/ })).toHaveCount(0);
      await expect(bosses.getByText(/^지역 \d+곳$/)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });

test("@일정카게 주간 점은 다른 요일마다 우리 일정 API 한 번씩(오늘은 서버 렌더), 실패한 날은 점 없이 @regression", async ({ page }) => {
  const asked = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname === "/api/home/schedule") asked.push(url.searchParams.get("date") ?? "today");
  });
  // One day keeps failing: that day just has no dot, nothing else changes.
  let failed = null;
  await page.route("**/api/home/schedule?date=*", (route) => {
    const date = new URL(route.request().url()).searchParams.get("date");
    failed ??= date;
    if (date === failed) return route.fulfill({ status: 503, json: { code: "LOST_ARK_UNAVAILABLE", message: "x", data: null } });
    return route.continue();
  });
  await gotoReady(page, "/schedule");
  await expect(page.getByRole("group", { name: "요일 선택" }).getByRole("button")).toHaveCount(7);
  await expect(page.locator("[class*=kindDots] [data-kind]")).toHaveCount(6);
  await page.waitForTimeout(500);
  // Today came with the page; each other day asked once (the failing one retried once).
  expect(asked.includes("today"), asked.join(",")).toBe(false);
  expect(new Set(asked).size, asked.join(",")).toBe(6);
  expect(asked.filter((date) => date === failed).length).toBe(2);
  expect(asked.length).toBe(7);
  // No error shown for the failing day (the board's own failure line stays away).
  await expect(page.getByText("일정을 불러오지 못했어요.")).toHaveCount(0);
});