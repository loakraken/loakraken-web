// 회귀(A7, #1559 CI bot-hero:487 1280 dark: 히어로 설명이 첫 그림에서 234x31 → 298x62, 그리고 bot-notes:22 1280:
// 시세 줄 이름이 줄바꿈되며 아이콘이 움직임): 첫 HTML은 어디서든 끊겨 올 수 있다. 홈 첫 화면의 모든 시작 태그 직후와 모든
// 글자 노드 직후에서 문서를 자르고, 나머지를 페이지 순서대로 되돌려도 아무 상자도 움직이지 않는다. 시세의 줄 목록도 같다.
// 고친 것: 히어로 제목·설명·봇 문구, 머리글 로고·검색 단축키, 일정 카드 머리(제목·범례·토글)와 요일 단추, 시세 줄(가격 칸·
// 줄 높이·이름·가격 두 줄) — 시작 태그만으로 끝 크기(data-fp-label 크기용 글자, min-height, 고정 칸).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";
import { drawnFace, useUntunedSystemFace } from "../support/fonts.mjs";


for (const theme of ["light", "dark"])
  for (const width of [320, 360, 390, 1280])
    test(`@A7 홈 ${width} ${theme}: 첫 HTML이 어디서 끊겨도 첫 화면 상자가 움직이지 않는다 @regression`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((value) => localStorage.setItem("loakraken-theme", value), theme);
      await gotoReady(page, "/");
      await page.evaluate(() => document.fonts.ready);
      // The hero, the header and the schedule card (the bot draws on a canvas, not text).
      await expect(page.getByRole("heading", { name: /당신의 캐릭터/ })).toBeVisible();
      await expect(page.getByRole("group", { name: "요일 선택" })).toBeVisible();
      const cut = await cutEverywhere(page, null);
      expect(cut.probed).toBeGreaterThan(40);
      expect(cut.value, `늦게 온 부분이 민 것:\n${cut.moved.join("\n")}`).toBe(0);
    });

// #1618: at 360 and narrower the schedule head's tools (toggle + legend) are on their own line under the heading from
// the first paint. With a phone's own font (the site font is display: optional; here its files are held back) the head
// needed ~275 of 268px at 320, so everything wrapped and the head grew when the legend came late. Each part on one
// line, the tools below the heading, the legend text kept, and nothing in the card moves wherever the HTML is cut.
for (const width of [320, 360])
  test(`@A7 홈 ${width} 기기 글꼴: 일정 카드 머리의 토글·범례가 제목 아래 한 줄, 첫 HTML이 끊겨도 움직이지 않는다 @regression`, async ({ page }) => {
    test.slow();
    // The font files are held, never answered (an aborted request is a console error): display: optional then
    // keeps the system face for the whole visit, as a phone without the file paints.
    await page.route(/\.woff2(\?|$)/, () => {});
    // A phone's own face at its own widths: the metric-matched fallback (#1753) draws at the site font's widths on
    // Windows and Linux, so it is left out here (support/fonts.mjs).
    await useUntunedSystemFace(page);
    await page.setViewportSize({ width, height: 1000 });
    // Not gotoReady: its network wait would sit on the held fonts.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const card = page.locator("section#schedule");
    const heading = card.getByRole("heading", { name: "주간 일정표" });
    const toggle = card.getByRole("button", { name: "지난 회차 숨김" });
    const legend = card.locator('[data-fp-label="골드 섬"]');
    await expect(heading).toBeVisible();
    await expect(legend).toBeVisible();
    await expect(card.getByRole("group", { name: "요일 선택" })).toBeVisible();
    // The font really is the fallback (the test means nothing on the site font).
    expect(await drawnFace(page), "맞추지 않은 시스템 글꼴로 그림").toBe("untuned");
    const box = async (locator) => (await locator.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
    const [h, t, l] = [await box(heading), await box(toggle), await box(legend)];
    expect(t.y, "토글이 제목 아래 줄").toBeGreaterThanOrEqual(h.y + h.height);
    expect(Math.abs(l.y + l.height / 2 - (t.y + t.height / 2)), "범례와 토글이 한 줄").toBeLessThan(2);
    // One line each (a wrapped part is two lines tall): the heading 17px text, the 28px toggle, the 12px legend.
    expect(h.height).toBeLessThan(30);
    expect(t.height).toBeLessThan(32);
    expect(l.height).toBeLessThan(20);
    // The parts are nowrap: in the system face they must still fit the card (codex #1678 P3).
    const head = await card.locator("div:has(> #schedule-heading)").evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(head.scroll, "머리 줄이 카드 안에").toBeLessThanOrEqual(head.client);
    await expectNoHorizontalOverflow(page);
    const cut = await cutEverywhere(page, "section#schedule|");
    expect(cut.probed, cut.moved.join(" / ")).toBeGreaterThan(10);
    expect(cut.value, `늦게 온 부분이 민 것:\n${cut.moved.join("\n")}`).toBe(0);
  });

// 1280: the width bot-notes:22 failed at. On phones a long name wraps and makes its row taller than the
// reserved two lines, so a centred icon still moves there; that needs a design call (follow-up).
for (const width of [1280])
  test(`@A7 시세 줄 ${width}: 첫 HTML이 줄 안에서 끊겨도 이름·아이콘·가격이 움직이지 않는다 @regression`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height: 1000 });
    await gotoReady(page, "/market");
    await expect(page.getByRole("button", { name: /최근 거래/ }).first()).toBeVisible();
    // Only the board's rows: the list that holds the '최근 거래' rows.
    const cut = await cutEverywhere(page, "ul|최근 거래");
    expect(cut.probed).toBeGreaterThan(20);
    expect(cut.value, `늦게 온 부분이 민 것:\n${cut.moved.join("\n")}`).toBe(0);
  });
