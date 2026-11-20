// 회귀(PM 총괄 11-21, v0.3.15): 스펙업 목록이 실제 답(계산 검증 05:41, develop c76685dc 스텁 api, 이름 가림
// '실목록1~4')을 제대로 그린다. 새 상급 재련 Δ점수 줄(api #1033), 한 번에 여러 단계 오르는 줄, 접힌 줄, 크라켄 점수
// 순서, 목록 아래 문장, 320 · 1280에서 잘림 · 넘침 · 흔들림 없음.
// - '실목록2'(업화 장비)의 크라켄 점수 목록: 계산된 50개 아래로, 전투력은 아직 계산하지 않았지만 점수가 있는 57개(방어구
//   상급 재련 다섯 줄 포함)가 이어진다. 목록 아래 문장은 그 둘을 따로 센다(전: '136개 중 위에서 107개').
// - '실목록2전체': 같은 답을 자르지 않은 것. 50개 안에 들지 못하는 무기 상급 재련 줄을 읽는다.
// - 완갑 줄은 kind가 재련(EQUIPMENT_REFINE)이고 바꾸는 것이 완갑(ARM_GUARD)이라 '완갑'으로 부른다(실목록1의 접힌 줄).
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const list = async (page, who, sort) => {
  await page.goto(`${characterPath(who, "specup")}&sort=${sort}`);
  const table = page.getByRole("table", { name: /스펙업 후보/ });
  await table.locator("tbody tr").first().waitFor();
  return table;
};

/** No cell clipped inside the table (A37: each cell's own text fits). */
async function expectNoClippedCell(table) {
  const clipped = await table.evaluate((t) =>
    [...t.querySelectorAll("td, th")]
      .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
      .map((cell) => cell.innerText.replace(/\s+/g, " ").slice(0, 40)),
  );
  expect(clipped, "잘린 칸").toEqual([]);
}

for (const width of [320, 1280]) {
  test(`${width}: 크라켄 점수 목록 — 방어구 상급 재련 Δ점수 줄, 목록 아래 문장이 계산된 줄과 점수만 있는 줄을 따로 센다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await watchShifts(page);
    const table = await list(page, "실목록2", "KRAKEN");
    const mark = await shiftMark(page);
    // The answer's order: the first ranked row is the answer's first candidate.
    await expect(table.locator("tbody tr").first()).toContainText("도래한 결전의 반지");
    for (const [piece, delta] of [
      ["+15 운명의 업화 장갑", "+0.60"],
      ["+15 운명의 업화 견갑", "+0.54"],
      ["+15 운명의 업화 투구", "+0.51"],
      ["+14 운명의 업화 하의", "+0.42"],
      ["+14 운명의 업화 상의", "+0.39"],
    ]) {
      const row = table.locator("tbody tr").filter({ hasText: piece }).filter({ hasText: "상급 재련 21단계" });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("상급 재련 20단계 → 상급 재련 21단계");
      await expect(row).toContainText(delta);
      await expect(row).toContainText("비용 미확인");
      await expect(row).not.toContainText("기타");
    }
    await expect(page.getByText("계산된 후보 136개 중 위에서 50개를 보여 드려요. 전투력을 아직 계산하지 않은 57개는 점수 순으로 그 아래에 이어요.")).toBeVisible();
    await expect(page.getByText(/136개 중 위에서 107개/)).toHaveCount(0);
    await page.waitForTimeout(500);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoClippedCell(table);
    await expectNoHorizontalOverflow(page);
  });

  test(`${width}: 무기 상급 재련 줄(자르지 않은 답)은 '상급 재련 21단계 → 22단계'와 Δ점수 +3.02 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const table = await list(page, "실목록2전체", "KRAKEN");
    const row = table.locator("tbody tr").filter({ hasText: "+16 운명의 업화 한손검" }).filter({ hasText: "상급 재련 22단계" });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("상급 재련 21단계 → 상급 재련 22단계");
    await expect(row).toContainText("+3.02");
    if (width >= 768) await expect(row.locator("[data-cell='kind']")).toHaveText("상급 재련");
    await expectNoClippedCell(table);
    await expectNoHorizontalOverflow(page);
  });

  test(`${width}: 효율 목록 — 한 번에 여러 단계 오르는 재련 줄(+16 → +25)과 시세 대기 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const table = await list(page, "실목록2", "EFFICIENCY");
    const row = table.locator("tbody tr").filter({ hasText: "+16 운명의 업화 한손검" }).filter({ hasText: "+16 → +25" });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("+141.65");
    await expect(row).toContainText("시세 대기");
    await expect(page.getByText("계산된 후보 91개 중 위에서 50개를 보여 드려요.", { exact: true })).toBeVisible();
    await expectNoClippedCell(table);
    await expectNoHorizontalOverflow(page);
  });

  test(`${width}: 접힌 줄 — 완갑 줄은 '완갑'으로 부르고(재련 아님), api 문장 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await list(page, "실목록1", "KRAKEN");
    const folded = page.getByRole("region", { name: "아직 계산하지 않은 후보" });
    const group = folded.locator("summary");
    await expect(group).toHaveCount(1);
    await expect(group).toHaveText(
      "아크 그리드·아크 패시브·팔찌·완갑 8개 — 이 항목의 전투력 계산식을 아직 확인하고 있어 계산하지 않았습니다.",
    );
    await expectNoHorizontalOverflow(page);
  });
}
