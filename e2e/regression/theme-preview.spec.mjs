// 회귀(사용자 10-31): 테마 메뉴의 색 표시 — 밝은 화면에서 '딤'과 '다크' 점이 똑같아 보였다.
// 이제 각 테마의 작은 미리보기(24×16: 페이지·카드 칸·글줄을 그 테마의 실제 색으로, 1px 테두리).
// 세 테마에서 메뉴를 열어 미리보기 크기, 딤·다크의 서로 다른 색, 줄 넘침 없음을 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const PAGE = { 라이트: "rgb(255, 255, 255)", 딤: "rgb(34, 37, 43)", 다크: "rgb(15, 17, 20)" };

for (const theme of ["light", "dim", "dark"])
  for (const width of [320, 1280])
    test(`${theme} ${width}: 테마마다 자기 색 미리보기 @regression`, async ({ page }) => {
      await page.addInitScript((t) => {
        try {
          localStorage.setItem("loakraken-theme", t);
        } catch {}
      }, theme);
      await page.setViewportSize({ width, height: 800 });
      await gotoReady(page, "/");
      await page.getByRole("banner").getByRole("button", { name: "화면 테마" }).click();
      const group = page.getByRole("radiogroup", { name: "화면 테마" });
      await expect(group).toBeVisible();
      for (const [label, colour] of Object.entries(PAGE)) {
        const preview = group.getByRole("radio", { name: label }).locator("span[aria-hidden]").last();
        expect(await preview.evaluate((el) => [el.offsetWidth, el.offsetHeight]), `${label} 크기`).toEqual([24, 16]);
        expect(await preview.evaluate((el) => getComputedStyle(el.firstElementChild).backgroundColor), `${label} 페이지 색`).toBe(colour);
      }
      // 딤 and 다크 differ in every part (page, card block, text line).
      const parts = (label) =>
        group
          .getByRole("radio", { name: label })
          .locator("span[aria-hidden]")
          .last()
          .evaluate((el) => {
            const face = el.firstElementChild;
            return [face, ...face.children].map((part) => getComputedStyle(part).backgroundColor);
          });
      const [dim, dark] = [await parts("딤"), await parts("다크")];
      dim.forEach((colour, i) => expect(colour, `딤·다크 ${i}`).not.toBe(dark[i]));
      // Each option stays one row (no wrap at 320).
      const tall = await group.getByRole("radio").evaluateAll((els) => els.filter((el) => el.offsetHeight > 48).length);
      expect(tall, "두 줄로 접힌 항목").toBe(0);
      await expectNoHorizontalOverflow(page);
    });
