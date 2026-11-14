// 회귀(A7 첫 로드 흔들림, 캐릭터 화면 훑기 1차): 첫 HTML은 어디서든 끊겨 올 수 있다. 캐릭터 화면의 모든 탭에서 모든 시작 태그
// 직후·글자 노드 직후로 문서를 자르고 나머지를 페이지 순서대로 되돌려도, 배너(정보·사실 칸), 탭 줄, 오른쪽 도구 줄, 장비 패널,
// 통계 탭의 기록 차트 칸이 움직이지 않는다. 배너 정보 칸은 띠 가운데에 놓여 줄이 늦게 오면 앞줄이 위로 밀렸고(1280에서 171 →
// 100px), 탭 줄은 글자가 오며 높이가 바뀌었고(320 29 → 51px), 기록 차트 칸은 다음 칸이 오기 전까지 줄 전체를 차지했다(552 →
// 361px). 나머지 패널은 다음 훑기에서 다룬다.
import { test, expect, gotoReady, characterPath } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const TABS = [null, "stats", "skills", "arkpassive", "avatars", "collectibles", "siblings", "specup"];
// What this sweep holds still: the banner, the tab row and its tools, the gear panel, the history charts.
const HELD = [
  'section[aria-label$="캐릭터 요약"]',
  '[data-sticky-chrome]:has(nav[aria-label="캐릭터 정보 탭"])',
  'section[aria-label="장비"]',
  'section[aria-label="아이템 레벨"]',
  'section[aria-label="전투력"]',
  'section[aria-label="원정대 레벨"]',
].join(", ");

for (const [width, theme] of [
  [320, "light"],
  [360, "light"],
  [360, "dark"],
  [390, "light"],
  [1280, "light"],
  [1280, "dark"],
])
  test(`@A7 ${width} ${theme} 캐릭터 화면: 첫 HTML이 어디서 끊겨도 배너·탭 줄·장비·기록 차트가 움직이지 않는다 @regression`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width, height: 900 });
    const moved = [];
    for (const tab of TABS) {
      await gotoReady(page, characterPath("상세", tab));
      await page.evaluate(() => document.fonts.ready);
      const cut = await cutEverywhere(page, null, HELD);
      expect(cut.probed, `${tab ?? "combat"}: 잘라 본 곳`).toBeGreaterThan(20);
      if (cut.value > 0) moved.push(`${tab ?? "combat"} ${cut.value}: ${cut.moved.slice(0, 6).join(" / ")}`);
    }
    expect(moved, "움직인 상자").toEqual([]);
  });
