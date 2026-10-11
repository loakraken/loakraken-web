// 회귀: 마우스를 올린 상태에서도 글씨가 잘 보인다(사용자 10-12 "색 넣는 건 좋은데
// 글씨가 안 보이게 된다"). hover 배경은 옅은 틴트 토큰(--hover-surface) 하나라
// 글자색은 그대로. 대표 화면의 hover 대상을 라이트·딤·다크에서 올려 두고, 그 안의
// 글자마다 실제 배경과의 대비를 잰다: 본문 4.5:1, 큰 글자 3:1 미만이면 실패.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** Contrast of every text node inside the element, against its painted background. */
function contrastsInside(el) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "#000";
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top, bot) => {
    const a = top[3] + bot[3] * (1 - top[3]);
    return [0, 1, 2].map((i) => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = (c) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const out = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const host = node.parentElement;
    if (!node.textContent.trim() || !host || host.getBoundingClientRect().width < 1) continue;
    const cs = getComputedStyle(host);
    const layers = [];
    for (let n = host; n; n = n.parentElement) {
      const b = rgba(getComputedStyle(n).backgroundColor);
      if (b[3] > 0) layers.push(b);
      if (b[3] >= 0.99) break;
    }
    let bg = rgba(getComputedStyle(document.body).backgroundColor);
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    const fg = over(rgba(cs.color), bg);
    const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (+cs.fontWeight >= 700 && size >= 18.66);
    out.push({ text: node.textContent.trim().slice(0, 20), ratio: (hi + 0.05) / (lo + 0.05), min: large ? 3 : 4.5 });
  }
  return out;
}

const TARGETS = [
  { path: "/market", label: "시세 품목 행", target: (page) => page.locator("[aria-pressed]", { hasText: "아비도스" }).first() },
  { path: "/tools/raid-rewards", label: "레이드 보상 칩", target: (page) => page.locator('main button[aria-pressed="false"]').first() },
  { path: "/tools/refining", label: "재련 목표 칩", target: (page) => page.getByRole("button", { name: "+20", exact: true }) },
  { path: "/tools/more-reward", label: "더보기 칸", target: (page) => page.locator("main [class*=cell]").first() },
  {
    path: "/",
    label: "테마 목록 줄",
    target: async (page) => {
      await page.getByRole("banner").getByRole("button", { name: "화면 테마" }).click();
      return page.getByRole("radio", { checked: false }).first();
    },
  },
  { path: "/character/%EC%83%81%EC%84%B8", label: "캐릭터 탭", target: (page) => page.getByRole("navigation", { name: "캐릭터 정보 탭" }).getByRole("link", { name: "스킬", exact: true }) },
];

test.describe("hover 대비 @regression", () => {
  for (const theme of ["light", "dim", "dark"]) {
    for (const { path, label, target } of TARGETS) {
      test(`${theme} · ${label}: hover 상태 글자 대비`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem("loakraken-theme", t), theme);
        await gotoReady(page, path);
        const el = await target(page);
        await expect(el).toBeVisible();
        await el.hover();
        // let the colour transition finish
        await page.waitForTimeout(400);
        const results = await el.evaluate(contrastsInside);
        expect(results.length, `${label}: 글자를 찾지 못함`).toBeGreaterThan(0);
        for (const r of results) {
          expect(r.ratio, `${theme} ${label} "${r.text}" ${r.ratio.toFixed(2)}`).toBeGreaterThanOrEqual(r.min);
        }
      });
    }
  }
});
