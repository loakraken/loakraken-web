// 회귀(A7, CI flaky material-quote-box-categories:23 @1280 0.0000166, #1565 점검 표의 '견적·시세 머리 아이콘'):
// 도구·시세 화면 머리(아이콘 + 작은 제목·제목·설명)에서 아이콘은 세 줄의 가운데에 놓인다. 첫 HTML이 아이콘 직후에서
// 끊겨 오면 빈 줄 위에 먼저 그려졌다가 글자가 오며 약 13px 내려갔다. 이제 아이콘은 글자 뒤에 오므로(그림 자리는 그대로)
// 처음 그려질 때부터 제자리다. 머리의 모든 시작 태그 직후·글자 노드 직후에서 끊겨 와도 머리는 움직이지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

// Every screen with this head whose server HTML holds it, and its title. (숙제 체크 is loaded on the
// client only, ssr: false in homework-loader.tsx, so its head never arrives in parts; its icon moved too.)
const HEROES = [
  ["/market", "시세"],
  ["/market/accessories", "장신구 시세"],
  ["/market/gems", "보석 시세"],
  ["/market/alerts", "시세 알림"],
  ["/market/quote", "재료 구매 견적"],
  ["/market/accessories/search", "장신구 매물 검색"],
  ["/tools/abidos-craft", "아비도스 제작 손익"],
  ["/tools/auction", "경매 입찰가"],
  ["/tools/combat-power", "전투력 시뮬레이터"],
  ["/tools/contribution", "기여도 계산기"],
  ["/tools/crit-speed", "치적·뭉가·음돌"],
  ["/tools/hell-reward", "지옥 · 나락 보상"],
  ["/tools/life-energy", "생명의 기운 효율"],
  ["/tools/loa-shop", "로아샵 효율"],
  ["/tools/more-reward", "더보기 손익"],
  ["/tools/raid-cheatsheet", "레이드 컨닝페이퍼"],
  ["/tools/raid-rewards", "레이드 보상표"],
  ["/tools/refining", "재련 기대 비용"],
];
// The head: the icon, the kicker, the title, the copy and the back link (not the tabs or a list the section holds).
const HEAD = '[class*="heroIcon"], [class*="heroKicker"], [class*="heroCopy"], section > h1, [class*="_back_"]';

for (const width of [320, 360, 1280])
  test(`@A7 ${width} 도구·시세 머리: 첫 HTML이 어디서 끊겨도 아이콘·제목이 움직이지 않는다 @regression`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    const moved = [];
    for (const [path, title] of HEROES) {
      await gotoReady(page, path);
      await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
      const cut = await cutEverywhere(page, `main section|${title}`, HEAD);
      expect(cut.probed, `${path}: 잘라 본 곳`).toBeGreaterThan(3);
      if (cut.value > 0) moved.push(`${path} ${cut.value}: ${cut.moved.join(" / ")}`);
    }
    expect(moved, "움직인 머리").toEqual([]);
  });
