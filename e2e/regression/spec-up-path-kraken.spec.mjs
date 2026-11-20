// 스펙업 추천 순서의 크라켄 점수 답(api #967): sort=KRAKEN은 점수로 고른 순서라, 목록의 KRAKEN 보기처럼
// 점수로 말한다. 서포터의 KRAKEN 답은 전투력이 null(경로 finalCombatPower, 단계 deltaCombatPower ·
// combatPowerAfter). 웹은 아직 경로에 sort=KRAKEN을 묻지 않으므로(백엔드 11-15: 계약 반영과 null 전투력 표시가
// 먼저), 목 '스펙순서'의 답을 그 모양으로 바꿔 화면만 본다. 계약(null 허용)은 tests/spec-up-path.test.ts.
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const pathTable = (page) => page.getByRole("table", { name: /^추천 순서, / });
const rows = (page) => pathTable(page).locator("tbody tr:not([data-collapsed])");

for (const width of [320, 1280]) {
  test(`크라켄 점수 답은 점수로: 전투력이 null이어도 '—'·NaN 없이 점수 증가와 10만G당 점수 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/characters/spec-up/path?*", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const data = body.envelope.data;
      Object.assign(data, { sort: "KRAKEN", finalCombatPower: null, krakenScore: 100, finalKrakenScore: 112.5 });
      data.steps.forEach((step, i) =>
        Object.assign(step, {
          deltaCombatPower: null,
          combatPowerAfter: null,
          combatPowerPer10kGold: null,
          deltaKrakenScore: 6.25,
          krakenScoreAfter: 100 + 6.25 * (i + 1),
          krakenScorePer100kGold: i === 0 ? 10.42 : null,
        }),
      );
      await route.fulfill({ response, json: body });
    });
    await page.goto(characterPath("스펙순서", "specup"));

    const table = pathTable(page);
    await expect(table).toHaveAccessibleName("추천 순서, 크라켄 점수 기준");
    // The header row is the desktop table's; phones show each cell's data-label instead (detail.module.css).
    if (width >= 1280)
      await expect(table.getByRole("columnheader")).toHaveText(["순서", "종류", "대상", "전 → 후", "크라켄 점수", "추가 비용", "10만G당 점수"]);
    await expect(page.getByText(/2단계를 차례로 올리면 크라켄 점수 100\.00 → 112\.50\(\+12\.50\)/)).toBeVisible();

    const first = rows(page).first();
    const gain = first.locator('[data-cell="gain"]');
    await expect(gain).toHaveAttribute("data-label", "크라켄 점수");
    await expect(gain).toContainText("+6.25");
    await expect(gain).toContainText("→ 106.25");
    await expect(first.locator('[data-cell="eff"]')).toHaveAttribute("data-label", "10만G당");
    await expect(first.locator('[data-cell="eff"]')).toHaveText("10.42");
    await expect(rows(page).nth(1).locator('[data-cell="gain"]')).toContainText("→ 112.50");
    await expect(rows(page).nth(1).locator('[data-cell="eff"]')).toHaveText("—");
    // No combat power number is drawn from the null figures.
    await expect(table).not.toContainText("NaN");
    await expect(table).not.toContainText("전투력");
    await expect(page.getByText("크라켄 점수는 앞 단계를 모두 올린 상태에서 다시 계산한 값이에요.", { exact: false })).toBeVisible();
    // The excluded item has only its combat power (no score): listed without a figure.
    const excluded = page.locator("details", { hasText: "시세를 몰라 순서에서 뺀 항목 1개" });
    await excluded.locator("summary").click();
    await expect(excluded.getByRole("listitem")).toHaveCount(1);
    await expect(excluded).not.toContainText("지금 기준");
    await expectNoHorizontalOverflow(page);
  });
}

test("다른 기준의 답은 그대로 전투력으로", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(characterPath("스펙순서", "specup"));
  const table = pathTable(page);
  await expect(rows(page).first().locator('[data-cell="gain"]')).toHaveAttribute("data-label", "전투력");
  await expect(table.getByRole("columnheader")).toHaveText(["순서", "종류", "대상", "전 → 후", "전투력 증가", "추가 비용", "1만G당 전투력"]);
  await expect(page.getByText(/2단계를 차례로 올리면 전투력 /)).toBeVisible();
  await expect(page.getByText("전투력은 앞 단계를 모두 올린 상태에서 다시 계산한 값이에요.", { exact: false })).toBeVisible();
  const excluded = page.locator("details", { hasText: "시세를 몰라 순서에서 뺀 항목 1개" });
  await excluded.locator("summary").click();
  await expect(excluded).toContainText("지금 기준 +");
});
