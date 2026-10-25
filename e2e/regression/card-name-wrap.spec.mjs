// A37 (QA): long card names ('라제니스를 이끄는 니나브') were cut to a few
// letters in a narrow card on the combat tab, with no way to read the rest.
// The whole name now wraps inside the card. '긴카드' carries six long names.
import { test, expect, characterPath } from "../support/fixtures.mjs";

for (const width of [320, 360, 390, 1280]) {
  test(`카드 이름이 잘리지 않고 다 보인다 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(characterPath("긴카드"));
    const panel = page.getByRole("region", { name: "카드", exact: true });
    const names = panel.locator(":scope > ul").first().locator("figcaption strong");
    await expect(names).toHaveCount(6);
    await expect(names.first()).toHaveText("라제니스를 이끄는 니나브");
    const boxes = await names.evaluateAll((els) =>
      els.map((el) => {
        const small = el.nextElementSibling?.getBoundingClientRect();
        const figure = el.closest("figure").getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return {
          text: el.textContent,
          cut: el.scrollWidth - el.clientWidth,
          ellipsis: getComputedStyle(el).textOverflow,
          out: Math.max(figure.left - box.left, box.right - figure.right),
          overlap: small ? box.bottom - small.top : 0,
        };
      }),
    );
    for (const b of boxes) {
      expect(b.cut, b.text).toBeLessThanOrEqual(0);
      expect(b.ellipsis, b.text).not.toBe("ellipsis");
      expect(b.out, b.text).toBeLessThanOrEqual(0.5);
      expect(b.overlap, b.text).toBeLessThanOrEqual(0.5);
    }
  });
}
