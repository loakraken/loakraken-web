// QA v0.3.1 최종 P1(A5): a page that answers 404 after reading its request
// (a hidden tool on production, a note that is not there) showed the 404 in
// white under the dim and dark themes: <html> was drawn again without the
// theme the pre-paint script had set, and the 404 has no header to put it
// back. A plain unknown address was fine. Every theme, both kinds.
import { test, expect } from "../support/fixtures.mjs";

// A 404 page answers 404 by design; its resource error in the console is expected.
test.use({ allowConsoleErrors: true });

for (const theme of ["light", "dim", "dark"])
  test(`@A5 404는 ${theme} 테마를 따른다: 없는 주소와 요청을 읽은 뒤의 404 @regression`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("loakraken-theme", t), theme);
    // The theme's page colour, from a page that draws it right.
    await page.goto("/about");
    const expected = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    for (const path of ["/없는-주소", "/news/dev-notes/없는-글"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("페이지를 찾을 수 없어요");
      // After hydration (and any redraw of <html>), the theme is still there.
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      const seen = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme ?? "light",
        background: getComputedStyle(document.body).backgroundColor,
      }));
      expect(seen, path).toEqual({ theme, background: expected });
      await expect(page, path).toHaveTitle(/페이지를 찾을 수 없어요/);
    }
  });

// System theme (the default since 10-18, or stored "system") under a dark OS:
// the 404 follows the OS too, even after <html> is redrawn.
for (const stored of [null, "system"])
  test(`@A5 404는 ${stored ?? "저장값 없음"} + OS 다크에서 다크 @regression`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    if (stored) await page.addInitScript((t) => localStorage.setItem("loakraken-theme", t), stored);
    for (const path of ["/없는-주소", "/news/dev-notes/없는-글"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.documentElement.dataset.theme), path).toBe("dark");
      expect(await page.evaluate(() => document.documentElement.dataset.themeChoice), path).toBe("system");
    }
  });