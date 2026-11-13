// 회귀(QA 2026-11-13 01시 P3): 마우스를 쓰는 좁은 창(360)에서 장비 상세 카드가 아이템 옆으로 열리며
// 오른쪽 끝을 14px 넘었다(86..374). 288px 카드가 양옆 어디에도 들어가지 않으면 아이템 아래로 열고,
// 화면 안(양옆 12px)에 둔다. 넓은 화면은 지금처럼 옆(오른쪽, 자리가 없으면 왼쪽)에 연다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

const EDGE = 12;

async function openNecklace(page, width) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(characterPath("상세", "combat"));
  const trigger = page.getByRole("button", { name: "합성 목걸이 상세 보기" });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const card = page.getByRole("dialog");
  await expect(card).toBeVisible();
  // Settled: the open transition (150 ms) has ended.
  await expect(card).not.toHaveAttribute("data-starting-style");
  await page.waitForTimeout(200);
  return { trigger: await trigger.boundingBox(), card: await card.boundingBox(), side: await card.getAttribute("data-side") };
}

for (const width of [320, 360]) {
  test(`${width} 마우스 창: 상세 카드는 화면 안에 있고 아이템을 덮지 않는다 @regression`, async ({ page }) => {
    const { trigger, card, side } = await openNecklace(page, width);
    const where = `${side} ${Math.round(card.x)}..${Math.round(card.x + card.width)}`;
    expect(card.x, `카드 왼쪽 ${where}`).toBeGreaterThanOrEqual(EDGE - 0.5);
    expect(card.x + card.width, `카드 오른쪽 ${where}`).toBeLessThanOrEqual(width - EDGE + 0.5);
    // Beside, below or above the item, never over it.
    const apart =
      card.x >= trigger.x + trigger.width - 0.5 ||
      card.x + card.width <= trigger.x + 0.5 ||
      card.y >= trigger.y + trigger.height - 0.5 ||
      card.y + card.height <= trigger.y + 0.5;
    expect(apart, `카드가 아이템을 덮음 (${where})`).toBe(true);
    // Still a readable card, not a sliver.
    expect(card.width).toBeGreaterThanOrEqual(200);
  });
}

test("1280: 상세 카드는 지금처럼 아이템 옆에 열린다 @regression", async ({ page }) => {
  const { trigger, card, side } = await openNecklace(page, 1280);
  expect(["right", "left"]).toContain(side);
  expect(card.x + card.width).toBeLessThanOrEqual(1280);
  if (side === "right") expect(card.x).toBeGreaterThanOrEqual(trigger.x + trigger.width);
});
