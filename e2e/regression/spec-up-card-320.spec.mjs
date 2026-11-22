// QA v0.3.15 RC P3-2: the spec-up list's phone card at 320. '적용해 보기' and the cost shared one column, so the
// cost (7.5em + its label) left the target name beside the link a sliver: four lines with '자세히 · 다른 단계 N개'
// under it. And a cost that says 비용 itself read '기대 비용 비용 미확인' with its phone label.
import { test, expect, characterPath } from "../support/fixtures.mjs";

test("320: 스펙업 카드의 대상 이름은 링크 옆에서 두 줄 안, 비용 칸은 '비용'을 두 번 읽지 않는다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`${characterPath("방어구문닫힘", "specup")}&sort=DELTA`);
  const table = page.getByRole("table", { name: /스펙업 후보/ });
  await table.locator("tbody tr").first().waitFor();

  const row = table.locator("tbody tr").filter({ has: page.getByRole("button", { name: /^자세히 · 다른 단계/ }) }).first();
  await expect(row).toBeVisible();
  const fit = await row.locator('[data-cell="target"]').evaluate((cell) => {
    const name = cell.querySelector("button, a") ?? cell;
    const line = parseFloat(getComputedStyle(name).lineHeight) || 20;
    const text = [...name.querySelectorAll("span")].pop() ?? name;
    return { width: cell.getBoundingClientRect().width, lines: Math.round(text.getBoundingClientRect().height / line) };
  });
  expect(fit.width, `target cell ${fit.width}px`).toBeGreaterThanOrEqual(150);
  expect(fit.lines, `target name lines`).toBeLessThanOrEqual(2);

  const costs = await table.locator('tbody tr:not([data-collapsed]) [data-cell="cost"]').evaluateAll((cells) =>
    cells.map((cell) => ({ text: cell.textContent?.trim() ?? "", before: getComputedStyle(cell, "::before").content })),
  );
  expect(costs.length).toBeGreaterThan(0);
  for (const { text, before } of costs)
    if (text.includes("비용")) expect(before, `cost '${text}' label`).not.toContain("기대 비용");
  expect(costs.some(({ text }) => text.includes("비용 미확인")), "a 비용 미확인 row in the sample").toBe(true);
});
