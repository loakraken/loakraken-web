// 회귀: 화면에 붙는(sticky) 도구 설정 칸이 창보다 길어도 끝 요소까지 스크롤로 닿는다.
// 사용자 발견(2026-10-10 23:20): 치적 설정 칸 아래쪽이 페이지 끝까지 내려야만 보였다.
// 1440×800·1366×768(노트북 창)에서 페이지를 조금 내린 상태로 확인한다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const SIZES = [
  { width: 1440, height: 800 },
  { width: 1366, height: 768 },
];
const PAGES = [
  { name: "치적·뭉가·음돌", path: `/tools/crit-speed?character=${encodeURIComponent("언새늘")}` },
  { name: "경매 입찰가", path: "/tools/auction" },
  { name: "더보기 손익", path: "/tools/more-reward" },
];

test.describe("고정 설정 칸 끝까지 닿기 @regression", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "고정 칸은 넓은 화면에서만 붙는다");
  });

  for (const size of SIZES)
    for (const item of PAGES)
      test(`${item.name} ${size.width}×${size.height}`, async ({ page }) => {
        await page.setViewportSize(size);
        await gotoReady(page, item.path);
        await page.evaluate(() => window.scrollTo(0, 400));
        const panels = await page.evaluate(() =>
          [...document.querySelectorAll("main *")]
            .filter((el) => {
              const style = getComputedStyle(el);
              return style.position === "sticky" && style.top !== "auto" && el.lastElementChild;
            })
            .map((el) => {
              el.scrollTop = el.scrollHeight;
              const last = el.lastElementChild.getBoundingClientRect();
              return { bottom: Math.round(last.bottom), height: Math.round(el.getBoundingClientRect().height) };
            }),
        );
        for (const panel of panels) {
          expect(panel.height).toBeLessThanOrEqual(size.height);
          expect(panel.bottom).toBeLessThanOrEqual(size.height);
        }
      });
});
