// 회귀(A7, #1559 CI bot-hero:487 1280 dark: 히어로 설명이 첫 그림에서 234x31 → 298x62, 그리고 bot-notes:22 1280:
// 시세 줄 이름이 줄바꿈되며 아이콘이 움직임): 첫 HTML은 어디서든 끊겨 올 수 있다. 홈 첫 화면의 모든 시작 태그 직후와 모든
// 글자 노드 직후에서 문서를 자르고, 나머지를 페이지 순서대로 되돌려도 아무 상자도 움직이지 않는다. 시세의 줄 목록도 같다.
// 고친 것: 히어로 제목·설명·봇 문구, 머리글 로고·검색 단축키, 일정 카드 머리(제목·범례·토글)와 요일 단추, 시세 줄(가격 칸·
// 줄 높이·이름·가격 두 줄) — 시작 태그만으로 끝 크기(data-fp-label 크기용 글자, min-height, 고정 칸).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** Cut after every start tag and every text node inside `root` (first screen), append back in page order: what moved. */
const cutEverywhere = (page, rootSelector) =>
  page.evaluate(async (rootSelector) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const box = (r) => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    const label = (n) => {
      if (!n) return "::pseudo";
      if (n.nodeType === 3) return `#text '${n.textContent.trim().slice(0, 12)}'`;
      if (n.nodeType !== 1) return n.nodeName;
      return `${n.tagName.toLowerCase()} '${(n.textContent || "").trim().slice(0, 14)}'`;
    };
    const root = rootSelector
      ? [...document.querySelectorAll(rootSelector.split("|")[0])].find((el) => el.textContent.includes(rootSelector.split("|")[1]))
      : document.body;
    if (!root) return { probed: 0, value: 0, moved: ["root not found"] };
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 3 && !n.textContent.trim()) continue;
      const el = n.nodeType === 1 ? n : n.parentElement;
      if (!el || el.closest("svg,script,style,canvas")) continue;
      const r = el.getBoundingClientRect();
      if (r.top > innerHeight || r.bottom < 0 || r.width === 0) continue;
      nodes.push(n);
    }
    let value = 0;
    const moved = [];
    for (const n of nodes) {
      if (!n.isConnected) continue;
      const kids = n.nodeType === 1 ? [...n.childNodes] : [];
      const after = [];
      for (let node = n; node && node !== document.body; node = node.parentNode) {
        const siblings = [];
        for (let next = node.nextSibling; next; next = next.nextSibling) siblings.push(next);
        after.push([node.parentNode, siblings]);
      }
      for (const kid of kids) kid.remove();
      for (const [, siblings] of after) for (const s of siblings) s.remove();
      await frame();
      const entries = [];
      const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
      observer.observe({ type: "layout-shift" });
      if (n.nodeType === 1) n.append(...kids);
      await frame();
      for (const [parent, siblings] of after) parent.append(...siblings);
      await frame();
      await frame();
      entries.push(...observer.takeRecords());
      observer.disconnect();
      const v = entries.reduce((sum, entry) => sum + entry.value, 0);
      if (v > 0) {
        value += v;
        moved.push(
          `${label(n)} 뒤 → ` +
            [...new Set(entries.flatMap((e) => e.sources.map((s) => `${label(s.node)} ${box(s.previousRect)}→${box(s.currentRect)}`)))].slice(0, 3).join(" | "),
        );
      }
    }
    return { probed: nodes.length, value: +value.toFixed(7), moved };
  }, rootSelector);

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

for (const width of [1280, 360])
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
