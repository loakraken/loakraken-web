// 회귀(QA v0.3.14 RC P1-2, 11-20): 홈 주간 일정표의 섹션 머리는 첫 HTML이 어디서 끊겨도 움직이지 않는다 — 그날 마지막
// 회차가 끝나 '내일 일정 보기'가 붙는 때(모험 섬, 23:00–24:00 KST)도. 그 단추의 시작 태그 바로 뒤에서 끊기면 빈 단추(44px
// 누르는 칸)가 상태 줄 끝에 그려지고, 글자가 오면 줄 아래로 넘어가며 상태가 다시 놓였다(320·390 CLS 0.006~0.0076). 시계를
// 고정해 두 상태(23:30 끝남, 12:00 다음 회차)를 언제 돌려도 본다. 목 일정의 모험 섬은 매일 09·11·13·19·21·23시.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";
import { drawnFace, useUntunedSystemFace } from "../support/fonts.mjs";

const DAY = 86_400_000;
const kstNow = () => new Date(Date.now() + 9 * 3_600_000);
// The week's last day (Tuesday) has no tomorrow in range, so no button: test the day before then.
const dayOffset = () => (kstNow().getUTCDay() === 2 ? -1 : 0);
const kstAt = (hhmm) => Date.parse(`${kstNow().toISOString().slice(0, 10)}T${hhmm}:00+09:00`) + dayOffset() * DAY;

const islands = (page) => page.getByRole("region", { name: "모험 섬" });

const LEGS = [
  // [width, clock, face]: the phone's own face moved most (QA 390 0.0076); the site font at 320 too.
  [320, "23:30", "untuned"],
  [390, "23:30", "untuned"],
  [320, "23:30", "site"],
  [320, "12:00", "untuned"],
];

for (const [width, clock, face] of LEGS)
  test(`@A7 홈 ${width} ${clock} ${face}: 일정 섹션 머리가 첫 HTML이 어디서 끊겨도 움직이지 않는다 @regression`, async ({ page }) => {
    test.slow();
    await page.clock.setFixedTime(kstAt(clock));
    if (face === "untuned") {
      // Held, never answered (an aborted request is a console error): display: optional keeps the system face.
      await page.route(/\.woff2(\?|$)/, () => {});
      await useUntunedSystemFace(page);
    }
    await page.setViewportSize({ width, height: 1000 });
    if (face === "untuned") await page.goto("/", { waitUntil: "domcontentloaded" });
    else await gotoReady(page, "/");
    const head = islands(page).locator("header");
    await expect(head).toBeVisible();
    if (clock === "23:30") {
      await expect(head).toContainText("오늘 일정 종료");
      await expect(head.getByRole("button", { name: "내일 일정 보기" })).toBeVisible();
    } else {
      await expect(head.getByRole("button", { name: "내일 일정 보기" })).toHaveCount(0);
    }
    if (face === "site") await page.evaluate(() => document.fonts.ready);
    expect(await drawnFace(page), face === "site" ? "사이트 글꼴" : "맞추지 않은 시스템 글꼴").toBe(face);
    // A37: the button's label whole, the head inside the card.
    // The label's own text box inside the button's box (not scrollWidth: the hit-44 press area is a pseudo-element that
    // reaches past the button on phones and counts there without cutting anything).
    if (clock === "23:30") {
      const label = await head.getByRole("button", { name: "내일 일정 보기" }).evaluate((b) => {
        const range = document.createRange();
        range.selectNodeContents(b);
        const text = range.getBoundingClientRect();
        const box = b.getBoundingClientRect();
        return { lines: new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size, inside: text.left >= box.left - 0.5 && text.right <= box.right + 0.5 };
      });
      expect(label, "단추 글자가 한 줄로 단추 안에").toEqual({ lines: 1, inside: true });
    }
    await expectNoHorizontalOverflow(page);
    // The button is drawn by the client at this clock (the server renders at its own hour), so every node counts.
    const cut = await cutEverywhere(page, "section#schedule|", null, { serverHtml: false });
    expect(cut.probed, cut.moved.join(" / ")).toBeGreaterThan(10);
    expect(cut.value, `늦게 온 부분이 민 것:\n${cut.moved.slice(0, 8).join("\n")}`).toBe(0);
  });

// No whole-page first-load shift check here: page.clock pins the browser only, while the server renders the first HTML
// at its own hour, so such a check would depend on when it runs again. The cuts above run after the page woke, on the
// pinned clock's state (serverHtml: false), and the real-clock first-load checks stay in home-first-paint-sweep.

// 서버 시계와 기기 시계가 그날 마지막 회차 양쪽에 있을 때(#1799 후속, PM-프론트 11-20 02:50): 첫 HTML은 서버 시각의
// 상태로, 깬 뒤에는 기기 시각의 상태로 그린다. 상태 줄과 '내일 일정 보기'는 늘 한 줄에 함께 있고(머리 폭 440px 아래는
// 그 줄 따로, 위는 제목 줄), 상태가 바뀌어도 머리 높이와 아래 행 자리는 그대로여야 한다. 기기 시계는 서버(실제 시각)의
// 반대 상태로 고정한다: 모험 섬의 마지막 회차는 23시라, 실제로 23시 뒤면 기기는 12:00(다음 회차), 아니면 23:30(끝남).
// 목 서버의 nextAt은 늘 다음 날 첫 회차라(#1816), 끝난 쪽 머리는 어느 시각에 돌려도 '내일 09:00'까지 붙은 긴 글이다.
// 서버 쪽 상태는 깨기 전에 잡아, 상태가 정말 바뀐 판만 통과로 친다.
const kstToday = (hhmm) => Date.parse(`${kstNow().toISOString().slice(0, 10)}T${hhmm}:00+09:00`);

// [label, viewport width or the head width to reach]: phones, the 440 cut and both sides of it, desktop.
const SKEW_LEGS = [
  ["320", { viewport: 320 }],
  ["390", { viewport: 390 }],
  ["머리 439", { head: 439 }],
  ["머리 440", { head: 440 }],
  ["머리 441", { head: 441 }],
  ["1280", { viewport: 1280 }],
];

for (const [label, size] of SKEW_LEGS)
  test(`@A7 홈 ${label}: 서버와 기기 시계가 마지막 회차 양쪽이어도 일정 섹션 머리 높이와 행 자리가 그대로 @regression`, async ({ page }) => {
    test.slow();
    const serverDone = kstNow().getUTCHours() >= 23;
    const client = serverDone ? "12:00" : "23:30";
    await page.clock.setFixedTime(kstToday(client));
    // The heads as the server drew them: taken when the islands' rows first exist, before the page wakes.
    await page.addInitScript(() => {
      const snap = () =>
        [...document.querySelectorAll("#schedule section[aria-label]")].map((section) => {
          const head = section.querySelector("header");
          const rows = section.querySelector("ul");
          const top = section.getBoundingClientRect().top;
          return {
            name: section.getAttribute("aria-label"),
            state: head?.querySelector("[data-state]")?.getAttribute("data-state") ?? null,
            width: head ? Math.round(head.getBoundingClientRect().width) : null,
            head: head ? Math.round(head.getBoundingClientRect().height) : null,
            rows: rows ? Math.round(rows.getBoundingClientRect().top - top) : null,
          };
        });
      window.__snapHeads = snap;
      const take = () => {
        if (window.__headsAtServer !== undefined || !document.querySelector('#schedule section[aria-label="모험 섬"] ul li')) return;
        window.__headsAtServer = window.__lkHydrated ? null : snap();
      };
      new MutationObserver(take).observe(document, { childList: true, subtree: true });
    });
    const headWidth = async () => Math.round(await islands(page).locator("header").evaluate((head) => head.getBoundingClientRect().width));
    if (size.head) {
      // Find the viewport that gives the islands' head this width (the card's column sets it), then load anew.
      let width = size.head + 60;
      await page.setViewportSize({ width, height: 1000 });
      await gotoReady(page, "/");
      for (let i = 0; i < 4 && (await headWidth()) !== size.head; i++) {
        width += size.head - (await headWidth());
        await page.setViewportSize({ width, height: 1000 });
      }
      expect(await headWidth(), "머리 폭").toBe(size.head);
      await page.reload();
    } else {
      await page.setViewportSize({ width: size.viewport, height: 1000 });
      await gotoReady(page, "/");
    }
    await page.waitForFunction(() => window.__lkHydrated);
    await expect(islands(page).locator("header [data-state]")).toHaveAttribute("data-state", serverDone ? "upcoming" : "done");
    const before = await page.evaluate(() => window.__headsAtServer);
    const after = await page.evaluate(() => window.__snapHeads());
    expect(before, "깨기 전 서버가 그린 머리를 잡지 못함").not.toBeNull();
    const at = (list, name) => list.find((section) => section.name === name);
    // The leg tests something only if the state really changed after the page woke.
    expect(at(before, "모험 섬").state, "서버 상태").toBe(serverDone ? "done" : "upcoming");
    if (size.head) expect(at(after, "모험 섬").width, "머리 폭").toBe(size.head);
    for (const section of after) {
      const server = at(before, section.name);
      expect({ head: section.head, rows: section.rows }, `${section.name} (머리 ${section.width}px): ${server?.state} → ${section.state}`).toEqual({ head: server?.head, rows: server?.rows });
    }
    await expectNoHorizontalOverflow(page);
  });
