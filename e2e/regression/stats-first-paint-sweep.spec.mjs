// 회귀(A7 첫 로드 흔들림, user-checklist.spec.mjs:119 /stats @360 — 44px 누름 영역 44→60, rank-podium.spec.mjs:548
// 원정대 320 — 조건 막대 버튼이 셋째 버튼 글자가 오며 줄어듦): 첫 HTML은 어디서든 끊겨 올 수 있다. 통계와 랭킹 다섯 화면의
// 첫 화면에서 모든 시작 태그 직후·글자 노드 직후로 문서를 자르고 나머지를 페이지 순서대로 되돌려도 아무 상자도
// 움직이지 않는다(홈 훑기 home-first-paint-sweep과 같은 방법).
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const PAGES = [
  ["통계", "/stats"],
  ["캐릭터 랭킹", "/rankings"],
  ["팔찌 랭킹", "/rankings?type=bracelets"],
  ["수집품 랭킹", "/rankings?type=collectibles"],
  ["원정대 랭킹", "/rankings?type=roster"],
  ["길드 랭킹", "/rankings?type=guilds"],
];

for (const theme of ["light", "dark"])
  for (const width of [320, 360, 390, 1280])
    test(`@A7 ${width} ${theme} 통계·랭킹: 첫 HTML이 어디서 끊겨도 첫 화면 상자가 움직이지 않는다 @regression`, async ({ page }) => {
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
