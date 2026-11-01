// 회귀(사용자 11-01, 태블릿 세로 화면): 내실 탭 수집품 칸이 좁아져 이름이 한 글자씩 세로로 줄바꿈됐다.
// 칸은 220px 아래로 줄지 않고(그보다 좁으면 칸 수를 줄임), 이름은 낱말 사이에서만 줄을 바꾼다.
// 목에는 가장 긴 공식 이름(크림스네일의 해도·누크만의 환영석)이 있다.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

for (const width of [320, 600, 768, 900, 1024, 1069, 1280])
  test(`${width}: 수집품 칸 이름은 낱말 사이에서만 줄바꿈, 칸은 220px 이상 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세", "collectibles"));
    const panel = page.getByRole("region", { name: "수집품", exact: true });
    await expect(panel.getByText("크림스네일의 해도", { exact: true })).toBeVisible();
    const cards = await panel.locator("ul").first().evaluate((grid) =>
      [...grid.children].map((li) => {
        const name = li.querySelector("strong");
        const node = name?.firstChild;
        const range = document.createRange();
        // The line each letter sits on: a new line must start right after a space.
        const breaks = [];
        let top = null;
        for (let i = 0; node && i < node.textContent.length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const rect = range.getClientRects()[0];
          if (!rect) continue;
          if (top != null && rect.top > top + 4) breaks.push(i);
          top = rect.top;
        }
        const text = node?.textContent ?? "";
        return {
          name: text,
          width: li.getBoundingClientRect().width,
          midWord: breaks.filter((i) => text[i - 1] !== " " && text[i] !== " "),
        };
      }),
    );
    const grid = await panel.locator("ul").first().evaluate((el) => el.clientWidth);
    for (const card of cards) {
      expect(card.midWord, `${card.name}: 낱말 가운데서 줄바꿈`).toEqual([]);
      expect(card.width, `${card.name}: 칸 폭`).toBeGreaterThanOrEqual(Math.min(220, grid) - 1);
    }
    await expectNoHorizontalOverflow(page);
  });
