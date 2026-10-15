// 회귀(A37, QA 10-16 02시 실제 데이터): 캐릭터 '순위' 카드의 긴 값(큰 순위, '연안' 티어, 네 자리
// '다음 티어까지')이 칸 안에 다 보인다 — 배지는 잘리지 않고, 숫자는 한 덩어리로 줄을 바꾼다. 그리고
// 캐릭터 이미지를 못 불러와도 배너는 어두운 바탕이라 흰 글자가 읽힌다.
import { test, expect, gotoReady, characterPath } from "../support/fixtures.mjs";

const NAME = "가려짐긴값캐릭터";

for (const width of [1280, 360])
  test(`@A37 ${width} 순위 카드 긴 값이 칸 안에 다 보임 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath(NAME));
    const metric = page.getByRole("region", { name: "전투력 순위" });
    await expect(metric.getByText("연안").first()).toBeVisible();
    const problems = await page.locator('[aria-label$=" 순위"] li').evaluateAll((cells) =>
      cells.flatMap((li) => {
        const box = li.getBoundingClientRect();
        const out = [];
        const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent.trim();
          if (!text) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of range.getClientRects())
            if (r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1)) out.push(`칸 밖: ${text}`);
          // Cut by a clipping ancestor inside the cell (badge, line); a label
          // ending in "…" on purpose is not cut.
          for (let el = node.parentElement; el && el !== li.parentElement; el = el.parentElement)
            if (
              getComputedStyle(el).overflowX !== "visible" &&
              getComputedStyle(el).textOverflow !== "ellipsis" &&
              el.scrollWidth > el.clientWidth + 1
            ) {
              out.push(`잘림: ${text}`);
              break;
            }
          // A number never splits across lines.
          for (const n of text.match(/[\d,.]{4,}/g) ?? []) {
            const at = node.textContent.indexOf(n);
            const part = document.createRange();
            part.setStart(node, at);
            part.setEnd(node, at + n.length);
            if (new Set([...part.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size > 1)
              out.push(`숫자 쪼개짐: ${n}`);
          }
        }
        return out;
      }),
    );
    expect([...new Set(problems)], "순위 카드 글자").toEqual([]);
  });

for (const width of [1280, 360])
  test(`@A37 ${width} 캐릭터 이미지를 못 불러와도 배너는 어두운 바탕 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/\.(png|jpe?g|webp)(\?.*)?$/i, (route) => route.abort());
    await gotoReady(page, characterPath(NAME));
    const banner = page.getByRole("region", { name: /캐릭터 요약$/ });
    await expect(banner).toBeVisible();
    await page.waitForTimeout(500);
    // The band's own colour (not see-through to the page) must be dark under the white text.
    const band = await banner.evaluate((el) => {
      const [r, g, b, a = 1] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number);
      const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return { alpha: a, luminance: 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) };
    });
    expect(band.alpha, "배너 바탕이 비치지 않음").toBe(1);
    expect(band.luminance, "배너 바탕이 어두움").toBeLessThan(0.05);
  });
