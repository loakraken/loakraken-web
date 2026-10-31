// 회귀(#1174·#1175): 어두운 테마에서 등급이 없는 아이콘 칸(내실 수집품·스킬·트라이포드)이 그림이 오기 전
// 흰 상자로 보였다. 이제 테마의 자리 표시 색(--secondary)이고, 칸 크기는 그대로다. 밝은 테마도 같은 토큰.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

for (const theme of ["dark", "dim", "light"])
  test(`${theme}: 등급 없는 아이콘 칸은 테마의 자리 표시 색, 크기 그대로 @regression`, async ({ page }) => {
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("loakraken-theme", t);
      } catch {}
    }, theme);
    await gotoReady(page, characterPath("상세"));
    // An icon tile from the page, cloned with no grade (the case before an image lands).
    const tile = page.locator('span[data-grade][aria-hidden="true"][class*="icon"]').first();
    await expect(tile).toBeAttached();
    const found = await tile.evaluate((el) => {
      const copy = el.cloneNode(false);
      copy.dataset.grade = "unknown";
      el.after(copy);
      const style = getComputedStyle(copy);
      const probe = document.createElement("span");
      probe.style.background = "var(--secondary)";
      document.body.append(probe);
      const secondary = getComputedStyle(probe).backgroundColor;
      const result = { background: style.backgroundImage, secondary, size: [copy.offsetWidth, copy.offsetHeight], base: [el.offsetWidth, el.offsetHeight] };
      copy.remove();
      probe.remove();
      return result;
    });
    // Both gradient stops are the theme's --secondary: no light tile on a dark page.
    expect(found.background, found.background).toBe(`linear-gradient(145deg, ${found.secondary}, ${found.secondary})`);
    expect(found.size, "칸 크기").toEqual(found.base);
  });
