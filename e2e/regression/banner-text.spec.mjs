// 회귀(A37 글자 가려짐): 캐릭터 배너의 왼쪽 글자(서버·직업, 이름, 칭호, 아이템·전투력·레벨, 순위 배지)는
// 긴 값이어도 왼쪽 칸 밖(휴대폰에선 오른쪽 캐릭터 이미지 위)으로 나가지 않고, 글자끼리 겹치지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const LONG = `/character/${encodeURIComponent("가려짐긴값캐릭터")}`;

for (const width of [360, 390, 768, 1024, 1280])
  test(`@A37 ${width} 배너 왼쪽 글자는 왼쪽 칸 안, 서로 겹치지 않음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, LONG);
    const banner = page.getByRole("region", { name: /캐릭터 요약$/ });
    await expect(banner.getByRole("heading", { level: 1 })).toHaveText("가려짐긴값캐릭터");
    const found = await banner.evaluate((root) => {
      const identity = root.querySelector("[class*=bannerIdentity]");
      // The left column's edge: the name's own box (each line there is held to it).
      const limit = identity.querySelector("h1").getBoundingClientRect().right + 1;
      const lines = [];
      const walker = document.createTreeWalker(identity, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width > 1) lines.push({ text: node.textContent.trim(), el: node.parentElement, r });
      }
      const out = lines.filter((l) => l.r.right > limit).map((l) => `밖: "${l.text}" ${Math.round(l.r.right)} > ${Math.round(limit)}`);
      for (let i = 0; i < lines.length; i++)
        for (let j = i + 1; j < lines.length; j++) {
          const a = lines[i], b = lines[j];
          if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
          const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (w > 1 && h > 1) out.push(`겹침: "${a.text}" × "${b.text}"`);
        }
      return out;
    });
    expect(found, "배너 왼쪽 글자가 칸 밖으로 나가거나 겹침").toEqual([]);
  });
