// 빈틈 #3 지옥 · 나락 보상: 열쇠 단계별 고정 보상을 시세(목 서버의 합성 값)와 직접 정한 값으로 매긴다.
// 목 시세: 빙하의 숨결 430G, 용암의 숨결 없음, 1730 지옥 재료(결정 9G · 수호석 결정 1.9G · 위대한 돌파석 33G · 상급 융화 271G).
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360, 320])
  test(`${width} 지옥 · 나락 보상: 시세 · 직접 정한 값 · 둘 중 하나, 단계표, 흔들림 0 @regression @smoke`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await page.goto("/tools/hell-reward");
    await expect(page.getByRole("heading", { level: 1, name: "지옥 · 나락 보상" })).toBeVisible();
    const sums = page.locator("dl").filter({ hasText: "시세로 매긴 것" });
    const total = sums.getByRole("definition").first();
    const lines = page.getByRole("list", { name: "보상 품목" });
    const line = (name) => lines.getByRole("listitem").filter({ hasText: name });

    // 지옥 1750 · 0단계 기본: 빙하 36 × 430 + 귀속 골드 5,500 (용암은 시세가 없어 0G, 나머지는 직접 값 0).
    await expect(total).toHaveText("20,980G");
    await expect(line("용암의 숨결")).toContainText("시세 없음 · 0G");
    await expect(line("파괴석")).toContainText("품목 확인 중 · 직접 정한 값");
    await expect(line("팔찌 상자 (고대)")).toContainText("시세 없음 · 직접 정한 값");
    await page.waitForTimeout(600);
    const first = await shiftsSince(page);
    expect(first.all, `시세 도착 흔들림 (${first.moved})`).toBe(0);

    // 직접 정한 값: 수호석 1개 3G → 1,800 × 3 = 5,400 (파괴석은 0이라 수호석 쪽으로 셈).
    await page.getByRole("spinbutton", { name: "수호석 1개 값(골드)" }).fill("3");
    await expect(total).toHaveText("26,380G");
    await expect(line("파괴석")).toContainText("둘 중 하나, 고르지 않음");
    await expect(line("수호석")).toContainText("둘 중 하나, 이쪽으로 셈");

    // 1730: 재료 이름이 정해져 시세로(귀속, 시세로 환산). 파괴석 결정 500 × 9 = 4,500 > 수호석 결정 1,500 × 1.9.
    await page.getByRole("radiogroup", { name: "열쇠 단계(입장 레벨)" }).getByRole("radio", { name: "1730" }).click();
    await expect(line("운명의 파괴석 결정")).toContainText("귀속, 시세로 환산");
    // 4,500 + 위대한 25 × 33 + 상급 60 × 271 + 빙하 30 × 430 + 귀속 골드 4,500.
    await expect(total).toHaveText("38,985G");

    // 단계표 11줄, 고른 단계가 표시된다.
    await page.getByLabel("클리어 단계").selectOption("10");
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(12);
    await expect(table.locator("tr[aria-current]")).toContainText("10단계");
    await expectNoHorizontalOverflow(page);
  });
