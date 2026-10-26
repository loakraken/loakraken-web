// 회귀(#1145, PM-프론트 측정 10-26): 320에서 아비도스 제작·생명의 기운의 시세 기준(세 칸)이
// 글꼴이 준비된 뒤에야 세로로 쌓여, 아래 카드·표를 88px 밀었다. 처음 그릴 때부터 쌓여 있어야 한다(A7).
import { test, expect } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const path of ["/tools/abidos-craft", "/tools/life-energy"])
  test(`320 ${path}: 첫 로드에 시세 기준 칸이 쌓인 채로 그려져 아래가 밀리지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await watchShifts(page);
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.getByRole("radiogroup", { name: "시세 기준" })).toBeVisible();
    await page.waitForTimeout(1000);
    const shifts = await shiftsSince(page);
    expect(shifts.all, `첫 로드 흔들림: ${shifts.moved}`).toBe(0);
  });
