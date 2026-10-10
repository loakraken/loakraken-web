// 긴 텍스트 넘침 검사 도우미(사용자 지시 2026-10-10: 홈 공지 글자가 칸 밖으로 넘침).
// 서버가 첫 HTML에 넣는 목록(공지 등)은 브라우저 가로채기가 닿지 않는다. 그래서 렌더된 글자 요소에
// 긴 글자를 직접 넣고, 요소가 자기 칸(li·td·th·dd·figure·a 버튼 등)과 영역(section) 밖으로
// 나가는지 boundingBox로 본다. 넘침은 CSS(줄바꿈·말줄임·min-width) 문제라 이 방식으로 드러난다.

export const LONG_TITLE =
  "[공지] 10월 15일(수) 정기 점검 및 업데이트 내역 안내 — 신규 레이드 개방, 이벤트 보상 지급 일정, 알려진 이슈 수정 사항 포함 (점검 연장 시 추가 안내 예정)";
// 캐릭터·길드 이름은 띄어쓰기가 없다(게임 규칙상 최대 12~16자, 여유 있게 길게).
export const LONG_NAME = "가나다라마바사아자차카타파하가나다라";

/**
 * selector에 맞는 요소 안의 글자 요소를 긴 글자로 바꾼 뒤, 칸·영역 밖으로 나간 요소를 돌려준다.
 * @param {import("@playwright/test").Page} page
 * @param {{ scope: string, cell: string, text: string, pick?: string }} o
 *   scope: 영역(예: '[aria-labelledby="notice-heading"]'), cell: 칸 선택자(예: "li"),
 *   pick: 칸 안에서 바꿀 글자 요소(없으면 가장 긴 글자 요소)
 */
export async function overflowAfterLongText(page, { scope, cell, text, pick }) {
  return page.evaluate(
    ({ scope, cell, text, pick }) => {
      const region = document.querySelector(scope);
      if (!region) return { filled: 0, problems: [`영역 없음: ${scope}`] };
      const cells = [...region.querySelectorAll(cell)];
      let filled = 0;
      for (const c of cells) {
        const leaves = pick
          ? [...c.querySelectorAll(pick)]
          : [...c.querySelectorAll("*")].filter((e) => !e.children.length && (e.textContent ?? "").trim());
        // 칸 자체가 글자 요소(자식 없음)이면 칸을 바꾼다.
        const target = (pick ? leaves[0] : leaves.sort((a, b) => b.textContent.length - a.textContent.length)[0]) ?? (!c.children.length ? c : null);
        if (target) {
          target.textContent = text;
          filled += 1;
        }
      }
      const R = region.getBoundingClientRect();
      const client = document.documentElement.clientWidth;
      const problems = [];
      for (const c of cells) {
        const C = c.getBoundingClientRect();
        if (!C.width) continue;
        if (C.right > R.right + 1 || C.left < R.left - 1)
          problems.push(`칸이 영역 밖: ${c.tagName} right=${Math.round(C.right)} 영역=${Math.round(R.right)}`);
        for (const e of c.querySelectorAll("*")) {
          const X = e.getBoundingClientRect();
          if (!X.width) continue;
          // 잘림 상자(overflow hidden·말줄임) 안이면 정상이다.
          let clipped = false;
          for (let a = e.parentElement; a && a !== c.parentElement; a = a.parentElement)
            if (getComputedStyle(a).overflowX !== "visible") {
              const A = a.getBoundingClientRect();
              if (A.right <= C.right + 1) clipped = true;
              break;
            }
          if (!clipped && X.right > C.right + 1) {
            problems.push(`글자가 칸 밖: ${e.tagName} right=${Math.round(X.right)} 칸=${Math.round(C.right)}`);
            break;
          }
        }
        if (problems.length >= 4) break;
      }
      if (document.documentElement.scrollWidth > client) problems.push(`가로 스크롤 ${document.documentElement.scrollWidth} > ${client}`);
      return { filled, problems };
    },
    { scope, cell, text, pick },
  );
}
