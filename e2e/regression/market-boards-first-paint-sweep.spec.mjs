// 회귀(A7 첫 로드 흔들림, gem-board.spec.mjs:93 @320 — 지난 값 칸의 변동(span.chg)이 15px 이동, gem-board.spec.mjs:22 @360):
// 첫 HTML은 어디서든 끊겨 올 수 있다. 보석 시세와 장신구 시세의 첫 화면에서 모든 시작 태그 직후·글자 노드 직후로 문서를
// 자르고 나머지를 페이지 순서대로 되돌려도 아무 상자도 움직이지 않는다(통계·랭킹 훑기 #1608과 같은 방법).
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const PAGES = [
  ["보석 시세", "/market/gems"],
  ["장신구 시세", "/market/accessories"],
];

for (const theme of ["light", "dark"])
  for (const width of [320, 360, 390, 1280])
    test(`@A7 ${width} ${theme} 보석·장신구 시세: 첫 HTML이 어디서 끊겨도 첫 화면 상자가 움직이지 않는다 @regression`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });
      const moved = [];
      for (const [name, path] of PAGES) {
        await gotoReady(page, path);
        await page.evaluate(() => document.fonts.ready);
        const cut = await cutEverywhere(page, null);
        expect(cut.probed, `${name}: 잘라 본 곳`).toBeGreaterThan(20);
        if (cut.value > 0) moved.push(`${name} ${cut.value}: ${cut.moved.join(" / ")}`);
      }
      expect(moved, "움직인 상자").toEqual([]);
    });
