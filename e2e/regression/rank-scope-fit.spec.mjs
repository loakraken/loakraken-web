// 회귀(A37): 순위 범위의 종류·값을 한 줄 말줄임으로 표시해 서버·직업 이름이 잘렸다.
// 두 줄의 전체 글자가 네 칸·세 칸 배치 모두에서 칸 안에 보이고, 긴 단어도 넘치지 않는다.
import { test, expect, gotoReady, characterPath } from "../support/fixtures.mjs";

const CHARACTERS = [
  {
    name: "상세",
    scopes: [["전체", null], ["서버", "아만"], ["직업", "블래스터"], ["서버 직업", "아만 블래스터"]],
  },
  {
    name: "가려짐긴값캐릭터",
    scopes: [["전체", null], ["서버", "아브렐슈드"], ["직업", "데모닉"]],
  },
];

test.describe("순위 범위 전체 표시 @A37 @smoke @regression", () => {
  test.use({ reducedMotion: "reduce" });

  for (const width of [320, 360, 390, 1280]) {
    for (const { name, scopes } of CHARACTERS) {
      test(`${width}px ${name}: 범위 종류와 값이 칸 안에 다 보임`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await gotoReady(page, characterPath(name));
        const cells = page.locator('[aria-label$=" 순위"] li');
        await expect(cells, "두 지표의 모든 순위 칸").toHaveCount(scopes.length * 2);
        await page.evaluate(() => document.fonts.ready);

        // The cut itself first: the words must fit (this is what failed before).
        const problems = await cells.evaluateAll((cells) => cells.flatMap((li) => {
          const scope = li.querySelector(":scope > span");
          if (!scope) return ["범위 라벨 없음"];
          const box = li.getBoundingClientRect();
          const out = [];
          if (scope.scrollWidth > scope.clientWidth + 1) out.push(`범위 가로 넘침: ${scope.textContent}`);
          const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
          const lines = [];
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (!text) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
            if (!rects.length) out.push(`범위 글자 숨김: ${text}`);
            lines.push(rects);
            for (const r of rects) {
              if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1)
                out.push(`칸 밖: ${text}`);
            }
            // 값 줄부터 li까지 확인한다. 말줄임은 실제 넘침 여부와 무관하게 실패다.
            for (let el = node.parentElement; el && el !== li.parentElement; el = el.parentElement) {
              const style = getComputedStyle(el);
              const bounds = el.getBoundingClientRect();
              if (style.textOverflow === "ellipsis") out.push(`범위 말줄임: ${text}`);
              if (rects.some((r) =>
                (style.overflowX !== "visible" && (r.left < bounds.left - 1 || r.right > bounds.right + 1)) ||
                (style.overflowY !== "visible" && (r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1))
              )) out.push(`범위 잘림: ${text}`);
            }
          }
          // 값이 있으면 종류의 마지막 줄 아래에서 시작한다. 선언값 대신 실제 위치를 잰다.
          if (lines.length === 2 && lines[0].length && lines[1].length &&
              Math.min(...lines[1].map((r) => r.top)) < Math.max(...lines[0].map((r) => r.bottom)) - 1)
            out.push(`범위 종류·값이 같은 줄: ${scope.textContent}`);
          return out;
        }));
        expect([...new Set(problems)], "범위 글자 잘림·넘침·말줄임 없음").toEqual([]);

        for (let i = 0; i < scopes.length * 2; i++) {
          const [label, value] = scopes[i % scopes.length];
          const scope = cells.nth(i).locator(":scope > span").first();
          await expect(scope, "보이는 범위 종류").toBeVisible();
          await expect(scope, "범위 종류와 전체 값").toHaveText(value ? `${label} ${value}` : label);
          const valueLine = scope.locator(":scope > span");
          if (value) {
            await expect(valueLine, "보이는 범위 값").toBeVisible();
            await expect(valueLine, "별도 줄의 범위 값").toHaveText(value);
          } else await expect(valueLine, "전체 범위는 값 없음").toHaveCount(0);
        }
      });
    }
  }
});
