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
    // One price request for the result and the compare together (PM-프론트 #1932, performance first).
    let priceCalls = 0;
    page.on("request", (r) => r.url().includes("/api/markets/material-prices") && priceCalls++);
    await page.goto("/tools/refining");
    // 방어구 without books: the armour rows then use only priced materials (빙하의 숨결 430G) and judge. The weapon keeps
    // its books (unpriced in the mock) in different amounts on the two ways, and its 용암의 숨결 has no price.
    await page.getByRole("switch", { name: /^방어구 책 효과 적용/ }).click();
    await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
    await expect(page.getByRole("heading", { name: "필요 재료" })).toBeVisible();
    // Measured from when the result has its prices: the total above redraws as they land (the result's own behaviour,
    // not the compare's), which raced this mark at 1280 (0.0003 on #1943's run). The compare's other-way plans still
    // land after it, so its rows are measured.
    await expect(page.getByText(/^시세 \d{2}:\d{2} 기준 · 1분마다 새로 불러와요$/)).toBeVisible();
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
      await expect(row.getByRole("definition").nth(1)).toContainText(/숨결 [\d,]+개/);
    }
    // Comparable: both totals whole, the cheaper side said (also in words), a verdict against the breath's price.
    await expect(chest.getByRole("definition").first()).toContainText(/^[\d,]+\sG누골 [\d,]+\sG$/);
    await expect(chest.getByText("· 더 적게 들어요")).toHaveCount(1);
    await expect(chest).toContainText(/숨결 1개 가치 -?[\d,]+\sG · 시세 430\sG → (사서 써도 이득이에요|숨결 없이가 유리해요)\./);
    // Not comparable (PM-프론트 #1932): an unpriced material used in different amounts — both totals '이상', no cheaper
    // side, no breath value, and what was left out named.
    await expect(weapon.getByRole("definition").first()).toContainText(/^[\d,]+\sG 이상누골 [\d,]+\sG$/);
    await expect(weapon.getByRole("definition").nth(1)).toContainText(/^[\d,]+\sG 이상/);
    await expect(weapon.getByText("· 더 적게 들어요")).toHaveCount(0);
    await expect(weapon).toContainText("시세가 없는 재료를 두 방식이 다르게 써서 비교하지 않았어요.");
    await expect(weapon).toContainText(/시세가 없어 뺀 재료: .*업화.*용암의 숨결|시세가 없어 뺀 재료: .*용암의 숨결.*업화/);
    // Every left-out name is in what a screen reader gets (PM-프론트 #1943), and the short screen line is not read twice.
    const tree = await weapon.ariaSnapshot();
    for (const name of ["야금술 : 업화 [19-20]", "용암의 숨결"]) expect(tree, tree).toContain(name);
    expect(tree.match(/시세가 없어 뺀 재료/g) ?? [], tree).toHaveLength(1);
    await page.waitForTimeout(400);
    // The result's prices and the compare's are one request (the same list: its own materials and each part's breaths).
    expect(priceCalls, "재료 시세 요청 수").toBe(1);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
}
