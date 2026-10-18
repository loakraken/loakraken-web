// QA v0.3.1 P2-8: the day change in gold read '▼4.3' with no unit, in the list
// and in the item facts. It reads '▼4.3G (2.1%)' now, and the longer text is
// not cut anywhere (A37), with large prices (각인서) too.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const cut = (els) =>
  els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => `${el.textContent.trim()} ${el.clientWidth}<${el.scrollWidth}`);
const CHANGE = /^(?:[▲▼][\d,.]+G \(\d+\.\d%\)|[\d,.]+G \(0\.0%\)|[▲▼]?\d+\.\d%|—)$/;

for (const width of [1280, 360])
  for (const tab of ["재련 재료", "각인서"])
    test(`@A37 ${width} 시세 ${tab}: 등락 차액에 G, 목록·품목 정보 어디서도 잘리지 않음 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, "/market");
      await page.getByRole("tablist", { name: "시세 분류" }).getByRole("tab", { name: tab }).click();
      const board = page.getByRole("region", { name: new RegExp(`${tab} 시세`) });
      const changes = board.locator('[class*="change"][data-direction]');
      await expect(changes.first()).toBeVisible();
      const texts = await changes.allTextContents();
      for (const text of texts) expect(text.trim(), text).toMatch(CHANGE);
      expect(texts.some((text) => /G \(/.test(text)), "차액이 있는 줄").toBe(true);
      expect(await changes.evaluateAll(cut)).toEqual([]);

      // The facts of the first item: the amount line with its unit, whole.
      await board.getByRole("listitem").first().getByRole("button").click();
      const facts = page.locator("dl").filter({ hasText: "전일 평균 대비" });
      const fact = facts.locator("div").filter({ hasText: "전일 평균 대비" }).locator("dd");
      await expect(fact).toBeVisible();
      expect(await fact.locator("b").innerText()).toMatch(/^(?:[▲▼]?[\d,.]+G|[▲▼]?\d+\.\d%|—)$/);
      expect(await facts.locator("dd, dd *").evaluateAll(cut)).toEqual([]);
    });
