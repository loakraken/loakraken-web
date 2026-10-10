// 회귀: 긴 글자(공지 제목·캐릭터 이름·아이템 이름)가 칸 밖으로 넘치지 않는다. 1440·768·390.
// 사용자 발견(2026-10-10, v0.1.0): 홈 공지사항 글자가 칸 밖으로 넘침.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { overflowAfterLongText, LONG_TITLE, LONG_NAME } from "../support/long-text.mjs";

const WIDTHS = [1440, 768, 390];

const CASES = [
  { name: "홈 공지 제목", path: "/", scope: '[aria-labelledby="notice-heading"]', cell: "li", text: LONG_TITLE },
  { name: "홈 이벤트 제목", path: "/", scope: '[aria-labelledby="event-heading"]', cell: "li", text: LONG_TITLE },
  { name: "홈 인기 검색 캐릭터 이름", path: "/", scope: '[aria-labelledby="popular-heading"]', cell: "li", pick: "strong", text: LONG_NAME },
  { name: "홈 최근 검색 캐릭터 이름", path: "/", scope: '[aria-labelledby="recent-heading"]', cell: "li", pick: "strong", text: LONG_NAME, recent: true },
  { name: "랭킹 표 캐릭터 이름", path: "/rankings", scope: "main table", cell: "tr", pick: "a", text: LONG_NAME },
  { name: "캐릭터 배너 이름", path: characterPath("상세"), scope: '[aria-label$="캐릭터 요약"]', cell: "h1, h1 + *", text: LONG_NAME },
  { name: "캐릭터 장비 이름", path: characterPath("상세"), scope: 'section[aria-label="장비"]', cell: "li", text: LONG_TITLE },
  { name: "시세 품목 이름", path: "/market", scope: 'section[aria-labelledby="board-heading"]', cell: "li", pick: "strong", text: LONG_TITLE },
];

// 열린 버그가 있는 경우: test.fail 표시(고치면 "예상 밖 통과"로 알려 준다).
const KNOWN = { "홈 공지 제목": "web #304: 공지 제목 span이 nowrap·ellipsis인데 flex 조상에 min-width:0이 없어 칸이 늘어남" };

test.describe("긴 텍스트 넘침 @regression", () => {
  for (const c of CASES)
    for (const width of WIDTHS) {
      test(`${width}px ${c.name}`, async ({ page }) => {
        const bug = KNOWN[`${c.name}@${width}`] ?? KNOWN[c.name];
        test.fail(!!bug, bug);
        if (c.recent)
          await page.addInitScript(() =>
            localStorage.setItem(
              "loakraken:recent",
              JSON.stringify([{ name: "상세", server: "아만", className: "블래스터", itemLevel: 1780.83, at: Date.now() }]),
            ),
          );
        await page.setViewportSize({ width, height: 1000 });
        await gotoReady(page, c.path);
        const { filled, problems } = await overflowAfterLongText(page, c);
        expect(filled, `${c.name}: 긴 글자를 넣을 칸이 없음`).toBeGreaterThan(0);
        expect(problems, `${width}px ${c.name}`).toEqual([]);
      });
    }
});
