// 회귀(A7, CI flaky material-quote-box-categories:23 @1280 0.0000166, #1565 점검 표의 '견적·시세 머리 아이콘'):
// 도구·시세 화면 머리(아이콘 + 작은 제목·제목·설명)에서 아이콘은 세 줄의 가운데에 놓인다. 첫 HTML이 아이콘 직후에서
// 끊겨 오면 빈 줄 위에 먼저 그려졌다가 글자가 오며 약 13px 내려갔다. 이제 아이콘은 글자 뒤에 오므로(그림 자리는 그대로)
// 처음 그려질 때부터 제자리다. 머리의 모든 시작 태그 직후·글자 노드 직후에서 끊겨 와도 머리는 움직이지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

// Every screen with this head whose server HTML holds it: its title, and whether the head has the back link.
// (숙제 체크 is loaded on the client only, ssr: false in homework-loader.tsx, so its head never arrives in
// parts; its icon moved too.)
const HEROES = [
  ["/market", "시세", false],
  ["/market/accessories", "장신구 시세", false],
  ["/market/gems", "보석 시세", false],
  ["/market/alerts", "시세 알림", false],
  ["/market/quote", "재료 구매 견적", true],
  ["/market/accessories/search", "장신구 매물 검색", false],
  ["/tools", "도구 모음", true],
  ["/tools/abidos-craft", "아비도스 제작 손익", true],
  ["/tools/auction", "경매 입찰가", true],
  ["/tools/combat-power", "전투력 시뮬레이터", true],
  ["/tools/contribution", "기여도 계산기", true],
  ["/tools/crit-speed", "치적·뭉가·음돌", true],
  ["/tools/hell-reward", "지옥 · 나락 보상", true],
  ["/tools/life-energy", "생명의 기운 효율", true],
  ["/tools/loa-shop", "로아샵 효율", true],
  ["/tools/more-reward", "더보기 손익", true],
  ["/tools/raid-cheatsheet", "레이드 컨닝페이퍼", true],
  ["/tools/raid-rewards", "레이드 보상표", true],
  ["/tools/refining", "재련 기대 비용", true],
];
// The head's parts (the back link is the head's own link; class names are hashed in production, so it is
// matched by place, not by name). Not the tabs or a list the section holds.
const PARTS = {
  icon: ':scope > [class*="heroIcon"]',
  kicker: ':scope > [class*="heroKicker"]',
  title: ":scope > h1",
  copy: ':scope > [class*="heroCopy"]',
  back: ":scope > a",
};
const HEAD = Object.values(PARTS)
  .map((sel) => `section > ${sel.replace(":scope > ", "")}`)
  .join(", ");

for (const width of [320, 360, 1280])
  test(`@A7 ${width} 도구·시세 머리: 첫 HTML이 어디서 끊겨도 아이콘·제목이 움직이지 않는다 @regression`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    const moved = [];
    for (const [path, title, back] of HEROES) {
      await gotoReady(page, path);
      await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
      // Every part the head should have is there (a part the selectors miss would count nothing).
      const hero = page.locator("main section").filter({ has: page.getByRole("heading", { level: 1, name: title, exact: true }) }).first();
      const found = {};
      for (const [part, sel] of Object.entries(PARTS)) found[part] = await hero.locator(sel).count();
      expect(found, `${path} 머리`).toEqual({ icon: 1, kicker: 1, title: 1, copy: 1, back: back ? 1 : 0 });
      const cut = await cutEverywhere(page, `main section|${title}`, HEAD);
      expect(cut.probed, `${path}: 잘라 본 곳`).toBeGreaterThan(3);
      if (cut.value > 0) moved.push(`${path} ${cut.value}: ${cut.moved.join(" / ")}`);
    }
    expect(moved, "움직인 머리").toEqual([]);
  });
