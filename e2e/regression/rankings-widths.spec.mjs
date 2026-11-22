// 회귀(#1138, PM 총괄 11-19): 캐릭터 랭킹 표는 1280에서 가로로 밀리지 않고, 실제 데이터의 가장 긴 값(백엔드 11-19
// 분포: 이름 p99 12자, 서버 5자, 직업 6자, 직업 각인 p95 7자 / p99 9자 / 최대 10자)이 잘리지 않는다. 진화·깨달음·도약은
// 제목이 뜻을 말하고 칸은 숫자만, 늘 그 순서로(없는 값은 '-'), 이름은 칸의 이름표(aria-label)·title에. 직업 각인만
// 드문 긴 값이 '…'로 끝나고 title을 가진다. 320·768은 표 상자 안에서 밀린다(같은 꼴). 값은 자리표시 글자(실제 이름 없음).
import { test, expect, gotoReady, expectNoHorizontalOverflow, fixtureIgnoresConsole } from "../support/fixtures.mjs";
import { drawnFace } from "../support/fonts.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const LONGEST = [
  {
    // Page 200's last row (MAX_PAGE × PAGE_SIZE), the longest rank (PM-프론트 #1787 P3).
    rank: 10000,
    characterName: "가".repeat(12),
    serverName: "아브렐슈드",
    className: "홀리나이트",
    position: "SUPPORT",
    itemLevel: 1799.99,
    combatPower: 11170.05,
    bestCombatPower: 11170.05,
    arkPassivePoints: { evolution: 140, enlightenment: 101, leap: 70 },
    classEngraving: "가나다라마바사",
    estherWeapon: { refineLevel: 25, ellaStage: 2 },
    topPercent: 0.11,
  },
  { characterName: "W".repeat(12), classEngraving: "가나다라마바 사아자" },
  { arkPassivePoints: { evolution: null, enlightenment: 90, leap: null } },
];

const stubLongest = (page) =>
  page.route((url) => url.pathname === "/api/rankings", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    LONGEST.forEach((values, i) => Object.assign(json.envelope.data.rows[i], values));
    await route.fulfill({ response, json });
  });

const table = (page) => page.locator("main table").first();

// 1280 also with the site font blocked: display: optional draws the metric-matched fallback on many visits, and
// the columns leave ~5px of slack in all (PM-프론트 #1787 P2). The face that drew is proven, not assumed.
const LEGS = [
  [320, false],
  [768, false],
  [1280, false],
  [1280, true],
];

// Console errors are collected here (the blocked leg's woff2 failures are the only ones allowed), so the fixture's
// own check is off for this group; every leg still fails on any other console error.
test.describe("캐릭터 랭킹 열 폭", () => {
  test.use({ allowConsoleErrors: true });
for (const [width, blocked] of LEGS)
  test(`@A37 ${width}${blocked ? " 글꼴 막음" : ""} 캐릭터 랭킹: 가장 긴 값도 잘리지 않고, 잘리는 것은 title이 있는 직업 각인뿐 @regression`, async ({ page }) => {
    const errors = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const source = message.location().url ?? "";
      if (blocked && /\.woff2(\?|$)/.test(source) && message.text().includes("net::ERR_FAILED")) return;
      // The shared fixture's own allowances, the same rule (blocked third-party requests, local socket exhaustion, /api/ 4xx).
      if (fixtureIgnoresConsole(message)) return;
      errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    if (blocked) await page.route(/\.woff2(\?|$)/, (route) => route.abort());
    await page.setViewportSize({ width, height: 900 });
    await stubLongest(page);
    await gotoReady(page, "/rankings");
    await expect(table(page)).toBeVisible();
    await expect(table(page).locator("tbody tr").first()).toContainText("가".repeat(12));
    if (!blocked) await page.evaluate(() => document.fonts.ready);
    expect(await drawnFace(page), blocked ? "맞춘 대체 글꼴로 그림" : "사이트 글꼴로 그림").toBe(blocked ? "matched" : "site");
    const scan = await table(page).evaluate((t) => {
      const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim());
      const cut = [];
      for (const [r, tr] of [...t.querySelectorAll("tr")].entries())
        [...tr.children].forEach((cell, i) => {
          if (cell.scrollWidth > cell.clientWidth + 1)
            cut.push({ row: r, column: heads[i], text: cell.textContent.trim().slice(0, 14), title: cell.getAttribute("title") ?? "" });
        });
      let box = t.parentElement;
      while (box && getComputedStyle(box).overflowX === "visible") box = box.parentElement;
      return { cut, scroll: box ? box.scrollWidth - box.clientWidth : null };
    });
    // Only 직업 각인 may end in '…', and only with its whole text as the title.
    const wrong = scan.cut.filter((c) => c.column !== "직업 각인" || !c.title);
    expect(wrong, "잘린 칸(직업 각인 밖이거나 title 없음)").toEqual([]);
    // The p95 engraving (7 characters, row 1) is whole; only the 10-character one (row 2) may be cut.
    expect(scan.cut.filter((c) => c.row === 1), "7자 직업 각인이 잘림").toEqual([]);
    if (width === 1280) expect(scan.scroll, "1280에서 표가 가로로 밀림").toBeLessThanOrEqual(0);
    await expectNoHorizontalOverflow(page);
    // 진화·깨달음·도약: numbers in that order under the header, a missing one keeps its slot as '-'.
    await expect(table(page).locator("thead th").nth(7)).toHaveText("진화·깨달음·도약");
    const ark = (i) => table(page).locator("tbody tr").nth(i).locator("td").nth(6);
    await expect(ark(0)).toHaveText("140 · 101 · 70");
    await expect(ark(0)).toHaveAttribute("aria-label", "진화 140, 깨달음 101, 도약 70");
    // The hover text is on the numbers, hidden from screen readers, so the label is read once (#1787 P3).
    await expect(ark(0)).not.toHaveAttribute("title", /./);
    await expect(ark(0).locator("span[title]")).toHaveAttribute("title", "진화 140, 깨달음 101, 도약 70");
    await expect(ark(0).locator("span[title]")).toHaveAttribute("aria-hidden", "true");
    await expect(ark(2)).toHaveText("- · 90 · -");
    await expect(ark(2)).toHaveAttribute("aria-label", "진화 정보 없음, 깨달음 90, 도약 정보 없음");
    expect(errors, "웹 글꼴 막음 외의 콘솔 오류가 없어야 한다").toEqual([]);
  });
});

test("@A7 320 캐릭터 랭킹 첫 로드 흔들림 0(가장 긴 값) @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await stubLongest(page);
  await watchShifts(page);
  await gotoReady(page, "/rankings");
  await expect(table(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const loaded = await shiftsSince(page);
  expect(loaded.all, `첫 로드 흔들림 (${loaded.moved})`).toBe(0);
});
