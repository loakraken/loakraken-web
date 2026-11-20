// 첫 그림 검사 도우미 자체 검사(PM-프론트 #1794 P3): HTML 순서와 다르게 그리는 칸(CSS order 말고도 flex
// row-/column-reverse·wrap-reverse, grid의 줄 지정·dense)은 앞 칸이 다 그린 화면 아래에 있어도 그 끝을 자른다.
// 그래야 뒤 칸이 늦게 와 앞 칸을 밀어내는 흔들림을 잡는다. 순서를 바꾸지 않는 칸은 더 자르지 않는다(대조).
// 앞 칸(A, HTML 먼저)은 뒤 칸(B, 1200px)이 위에 그려져 다 그린 화면 밖이라, 화면 안 규칙만으로는 A를 자르지 않는다.
import { test, expect } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const A = '<div class="a"><p>앞 칸 글자</p></div>';
const B = '<div class="b"><p>뒤 칸 글자</p></div>';
const CASES = [
  ["column-reverse", "display:flex;flex-direction:column-reverse", true],
  ["wrap-reverse", "display:flex;flex-wrap:wrap-reverse;flex-direction:row", true],
  ["grid-row", "display:grid", true, ".a{grid-row:2}.b{grid-row:1}"],
  ["order", "display:flex;flex-direction:column", true, ".a{order:2}"],
  ["plain column", "display:flex;flex-direction:column", false],
];

for (const [name, parent, reordered, extra = ""] of CASES)
  test(`첫 그림 도우미: ${name} ${reordered ? "앞 칸 끝도 자른다" : "더 자르지 않는다"} @regression`, async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    // wrap-reverse: each child takes a whole line, so B's line is drawn above A's.
    const css = `body{margin:0;font:16px sans-serif}.box{${parent}}.box>div{width:100%}.a p{margin:0;height:40px}.b{height:1200px}.b p{margin:0}${extra}`;
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><main class="box">${A}${B}</main></body></html>`);
    // The helper waits for React to claim <body>; this page has no React.
    await page.evaluate(() => (document.body["__reactFiber$selftest"] = true));
    const cut = await cutEverywhere(page, "main|앞 칸", null, { serverHtml: false });
    // The shift first (what the helper is for), then the count it reports.
    if (reordered) {
      expect(cut.value, `잡은 흔들림: ${cut.moved.join(" / ")}`).toBeGreaterThan(0);
      expect(cut.moved.join(" "), "앞 칸 끝에서 자른 흔들림").toContain("앞 칸 글자");
      expect(cut.added, "더한 자르기").toBeGreaterThan(0);
    } else {
      expect(cut.value, cut.moved.join(" / ")).toBe(0);
      expect(cut.added).toBe(0);
    }
    expect(cut.ms).toBeGreaterThanOrEqual(0);
  });
