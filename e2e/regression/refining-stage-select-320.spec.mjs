// 회귀(#1128, PM-프론트 측정 10-26): 재련 기대 비용 '목표 단계'의 부위별 선택 칸(등급·현재·목표)이
// 320에서 '+18'·'+20'을 잘라 보였다(글자 22px, 칸 16px). 좁은 휴대폰에서도 단계 값이 다 보인다(A37).
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

for (const width of [320, 360])
  test(`${width}: 부위별 등급·현재·목표 선택 칸의 값이 잘리지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/tools/refining");
    await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
    const fields = page.locator('fieldset [data-slot="select"] > span');
    await expect(fields.first()).toBeVisible();
    const cut = await fields.evaluateAll((spans) =>
      spans.filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent.trim()),
    );
    expect(cut, "잘린 선택 값").toEqual([]);
    await expectNoHorizontalOverflow(page);
  });
