// 회귀: 캐릭터 배너 글자가 잘리거나 숫자·서버·직업이 단어 중간에서 줄바꿈되지 않는다.
// 기본 점검 폭은 1440·768·390이다(PM 결정 2026-10-09). 768에서 왼쪽 열이 좁아
// "1,700./5"처럼 끊기고 아래 줄이 배너 높이에 잘리는 결함(web #143)을 1440·390만 보다가 놓쳤다.
// 가로 넘침 검사(expectNoHorizontalOverflow)는 overflow: hidden 안의 잘림을 잡지 못한다. #143은 #146에서 고쳤다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

const WIDTHS = [1440, 768, 390];

/** 배너 안 글자 요소 중 잘림 상자 밖으로 나간 것, 그리고 숫자·짧은 값이 두 줄 이상이 된 것. */
async function bannerProblems(page) {
  return page.evaluate(() => {
    const banner = document.querySelector('[aria-label$="캐릭터 요약"]');
    if (!banner) return ["배너 없음"];
    const problems = [];
    const leaves = [...banner.querySelectorAll("*")].filter(
      (el) => !el.children.length && (el.textContent ?? "").trim() && el.getBoundingClientRect().width > 0,
    );
    for (const el of leaves) {
      const text = el.textContent.trim();
      const r = el.getBoundingClientRect();
      // 1) 잘림: overflow가 visible이 아닌 조상 상자 밖으로 나감(가로·세로)
      for (let a = el.parentElement; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const ar = a.getBoundingClientRect();
        if (r.left < ar.left - 1 || r.right > ar.right + 1 || r.top < ar.top - 1 || r.bottom > ar.bottom + 1) {
          problems.push(`잘림 "${text.slice(0, 20)}"`);
          break;
        }
      }
      // 2) 줄바꿈: 숫자 값이나 "서버 · 직업"처럼 짧은 값이 두 줄 이상
      const short = /^[\d,.+%\-]+$/.test(text) || (/·/.test(text) && text.length <= 20);
      if (short) {
        const line = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.3;
        if (r.height > line * 1.6) problems.push(`줄바꿈 "${text}"`);
      }
    }
    return problems;
  });
}

test.describe("캐릭터 배너 잘림·줄바꿈 @regression", () => {
  for (const width of WIDTHS) {
    for (const name of ["상세", "상세서포터"]) {
      test(`${width}px '${name}' 배너 글자가 잘리지 않는다`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(characterPath(name));
        await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
        await page.waitForLoadState("networkidle");
        expect(await bannerProblems(page), `${width}px 배너 문제`).toEqual([]);
      });
    }
  }
});
