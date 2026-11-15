// 회귀(A7 첫 로드 흔들림, abidos-craft.spec.mjs:108 @360): 첫 HTML은 어디서든 끊겨 올 수 있다. 좁은 화면(900px 이하)은
// 결과 표가 '계산 조건' 위에 보이지만(CSS order) 문서에서는 '계산 조건'이 먼저라, 결과가 늦게 오면 이미 그려진 '계산 조건'을
// 아래로 밀었다. 아비도스 제작 손익과 생명의 기운 계산기의 첫 화면에서 모든 시작 태그 직후·글자 노드 직후로 문서를 자르고
// 나머지를 페이지 순서대로 되돌려도 아무 상자도 움직이지 않는다(통계·랭킹 #1608, 시세 #1616과 같은 방법).
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const PAGES = [
  ["아비도스 제작 손익", "/tools/abidos-craft"],
  ["생명의 기운", "/tools/life-energy"],
];

for (const theme of ["light", "dark"])
  for (const width of [320, 360, 390, 1280])
    test(`@A7 ${width} ${theme} 아비도스 제작·생명의 기운: 첫 HTML이 어디서 끊겨도 첫 화면 상자가 움직이지 않는다 @regression`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });
      const moved = [];
      for (const [name, path] of PAGES) {
        await gotoReady(page, path);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const cut = await cutEverywhere(page, null);
        expect(cut.probed, `${name}: 잘라 본 곳`).toBeGreaterThan(20);
        if (cut.value > 0) moved.push(`${name} ${cut.value}: ${cut.moved.join(" / ")}`);
      }
      expect(moved, "움직인 상자").toEqual([]);
    });
