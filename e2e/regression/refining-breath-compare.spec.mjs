// M41 (PM 총괄 11-22 13:40): 재련 기대 비용 shows, per part, the same target 숨결 없이 vs 숨결 최대 (each at market,
// 누골 apart) and one breath's value against its price. Mock (tests/mock-backend.mjs): 빙하의 숨결 has a price
// (430G), 용암의 숨결 has none, the 업화 books have none — so an armour row (상의) judges, the 무기 row says it cannot, and
// both name what was left out. The rows hold their lines while the extra plans load (no shift under the result).
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [320, 1280]) {
  test(`${width}: 부위마다 숨결 없이 · 숨결 최대 비교와 숨결 1개 가치 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    // The page asks for the user's own way (숨결 꺼짐); the compare asks for the other one too.
    const withBreath = page.waitForRequest(
      (r) => r.url().includes("/api/refining/plans") && r.postDataJSON()?.equipmentType === "WEAPON" && r.postDataJSON()?.useBreath === true,
    );
    await page.goto("/tools/refining");
    await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
    await expect(page.getByRole("heading", { name: "필요 재료" })).toBeVisible();
    const mark = await shiftMark(page);
    await withBreath;

    const compare = page.getByRole("region", { name: "숨결 쓰기 비교" });
    const rows = compare.getByRole("listitem");
    const weapon = rows.filter({ hasText: "무기" });
    const chest = rows.filter({ hasText: "상의" });
    await expect(weapon).toHaveCount(1);
    await expect(chest).toHaveCount(1);
    for (const row of [weapon, chest]) {
      await expect(row.getByRole("definition")).toHaveCount(2);
      await expect(row.getByRole("definition").first()).toContainText(/^[\d,]+ G누골 [\d,]+ G$/);
      await expect(row.getByRole("definition").nth(1)).toContainText(/숨결 [\d,]+개/);
      await expect(row).toContainText(/시세가 없어 뺀 재료: .*업화/);
    }
    await expect(weapon).toContainText(/숨결 1개 가치 [\d,]+ G · 숨결 시세가 없어 판단하지 않았어요\./);
    await expect(chest).toContainText(/숨결 1개 가치 -?[\d,]+ G · 시세 430 G → (사서 써도 이득이에요|숨결 없이가 유리해요)\./);

    await page.waitForTimeout(400);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
}
