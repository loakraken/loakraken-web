// 회귀(사용자 10-31): 스킬 카드의 룬 이름은 부제('Lv.14 · 풍요')가 아니라 보석 칩과 룬 아이콘 사이의 작은 글자
// (룬 등급 색). 두 번 나오지 않는다. 룬이 없으면 글자도 없다. 360 이하에서는 아이콘(과 카드)만, 줄이 접히지 않는다.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const skillRow = (page, name) => page.locator("li").filter({ has: page.getByText(name, { exact: true }) }).first();

for (const width of [1280, 390])
  test(`${width}: 룬 이름은 보석 칩과 룬 아이콘 사이, 부제에는 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세", "skills"));
    const row = skillRow(page, "합성 포격");
    const head = row.locator(":scope > div").first();
    await expect(head.locator("small")).not.toContainText("풍요");
    const label = head.getByText("풍요", { exact: true });
    await expect(label).toBeVisible();
    // In order: gem chips, the name, the rune icon; all on the head's one line.
    const order = await head.evaluate((el) => {
      const gems = el.querySelector('[aria-label="보석"]')?.getBoundingClientRect();
      const name = [...el.querySelectorAll("span")].find((s) => s.textContent === "풍요")?.getBoundingClientRect();
      const rune = el.querySelector('button[aria-label="풍요 상세 보기"]')?.getBoundingClientRect();
      const mid = (r) => r.top + r.height / 2;
      return {
        // The mock skill may have no gem chips: then only the name/icon order counts.
        gemsBefore: !gems || gems.right <= name.left + 0.5,
        runeAfter: name.right <= rune.left + 0.5,
        oneLine: Math.abs(mid(rune) - mid(name)) <= 2,
      };
    });
    expect(order).toEqual({ gemsBefore: true, runeAfter: true, oneLine: true });
    // A skill without a rune has no label (기본 스킬).
    await expect(skillRow(page, "기본 스킬").locator(":scope > div").first().getByText(/^(풍요|속행)$/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

test("360: 룬 이름은 숨고 아이콘과 카드만, 줄 접힘 없음 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await gotoReady(page, characterPath("상세", "skills"));
  const head = skillRow(page, "합성 포격").locator(":scope > div").first();
  await expect(head.getByText("풍요", { exact: true })).toBeHidden();
  await expect(head.getByRole("button", { name: "풍요 상세 보기" })).toBeVisible();
  // The head stays one row: the skill icon and the rune icon share a centre line.
  const sameLine = await head.evaluate((el) => {
    const skill = el.querySelector("button").getBoundingClientRect();
    const rune = el.querySelector('button[aria-label="풍요 상세 보기"]').getBoundingClientRect();
    return Math.abs(skill.top + skill.height / 2 - (rune.top + rune.height / 2)) <= 2;
  });
  expect(sameLine).toBe(true);
  await expectNoHorizontalOverflow(page);
});
