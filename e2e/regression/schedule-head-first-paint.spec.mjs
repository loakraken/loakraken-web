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
