// TEMP (not committed): the loading screen's settled boxes, for a before/after compare.
import { test, expect } from "../support/fixtures.mjs";

for (const width of [320, 360, 1280])
  test(`loading boxes ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/character/${encodeURIComponent("로딩")}`, { waitUntil: "commit" });
    const status = page.getByRole("status").filter({ hasText: "캐릭터 정보를 조회하고 있어요." });
    await expect(status).toBeVisible();
    await page.waitForTimeout(300);
    const boxes = await status.evaluate((line) => {
      const main = line.closest("main");
      const r = (el) => [...["x", "y", "width", "height"].map((k) => Math.round(el.getBoundingClientRect()[k] * 10) / 10)].join(",");
      return [r(main), ...[...main.children].filter((el) => el.tagName !== "NOSCRIPT").map((el) => `${el.tagName}:${r(el)}`)].join(" ");
    });
    console.log(`LOADBOX ${width} ${boxes}`);
  });
