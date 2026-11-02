// 회귀(사용자 11-01, 운영 DevTools Issues): "Interactive element inside of a <summary> element"가 많이 떴다 —
// 캐릭터 화면 아크 그리드 코어 줄의 <summary> 안에 코어·젬 카드 단추가 있었다(화면 이동 사이에 Issues가 쌓여 시세에서 보임).
// 이제 <summary> 안에는 누를 수 있는 요소가 없다(카드 단추는 줄 위에 겹쳐, summary 밖). 지연 그림은 크기를 갖는다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const INTERACTIVE = 'summary :is(button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]))';

const PAGES = [
  ["캐릭터 전투", characterPath("상세")],
  ["캐릭터 스펙업", characterPath("상세", "specup")],
  ["캐릭터 내실", characterPath("상세", "collectibles")],
  ["일정", "/schedule"],
  ["거래소 시세", "/market"],
  ["로아샵", "/tools/loa-shop"],
  ["재련", "/tools/refining"],
  ["더보기 손익", "/tools/more-reward"],
  ["경매 입찰가", "/tools/auction"],
];

test("<summary> 안에 누를 수 있는 요소가 없고, 지연 그림은 너비·높이를 갖는다 @regression", async ({ page }) => {
  test.slow();
  let summaries = 0;
  for (const [name, path] of PAGES) {
    await gotoReady(page, path);
    // Client-drawn parts (spec-up guide, market rows) land after the first paint.
    await page.waitForLoadState("networkidle");
    const here = await page.locator("summary").count();
    if (path === PAGES[0][1]) expect(here, `${name}: 아크 그리드 코어 summary`).toBeGreaterThan(0);
    summaries += here;
    expect(await page.locator(INTERACTIVE).count(), `${name}: summary 안의 단추·링크`).toBe(0);
    const unsized = await page
      .locator('img[loading="lazy"]')
      .evaluateAll((imgs) => imgs.filter((img) => !img.getAttribute("width") || !img.getAttribute("height")).map((img) => img.src));
    expect(unsized, `${name}: 크기 없는 지연 그림`).toEqual([]);
  }
  // Not a pass by absence: these pages draw summaries.
  expect(summaries, "확인한 summary 수").toBeGreaterThan(5);
});

for (const width of [1280, 390])
  test(`${width}: 아크 그리드 코어 줄 — 카드 단추는 summary 밖, 줄 모양 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세"));
    const panel = page.getByRole("region", { name: "아크 그리드" });
    const row = panel.locator("li:has(> details)").first();
    await expect(row).toBeVisible();
    // The core's card button is in the row, outside the details/summary.
    const core = row.locator(":scope > span button").first();
    await expect(core).toHaveAccessibleName(/상세 보기$/);
    await expect(row.locator("summary button")).toHaveCount(0);
    // codex P3 (#1315): the card buttons are the topmost element over their room, closed and open.
    const topmost = () =>
      row.evaluate((li) => {
        const at = (rect) => document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest("button");
        const icon = li.querySelector(":scope > span button");
        const room = li.querySelector("summary [class*=coreIconRoom]").getBoundingClientRect();
        const gems = li.querySelector(":scope > [class*=coreGems]");
        const shown = gems && getComputedStyle(gems).display !== "none";
        return {
          icon: at(room) === icon,
          gems: !shown || [...gems.querySelectorAll("button")].every((b) => at(b.getBoundingClientRect()) === b),
        };
      });
    await row.evaluate((li) => li.scrollIntoView({ block: "center" })); // clear of the sticky header
    expect(await topmost(), "닫힌 줄").toEqual({ icon: true, gems: true });
    const box = await row.evaluate((li) => {
      const r = (el) => el && el.getBoundingClientRect();
      const summary = r(li.querySelector("summary"));
      const icon = r(li.querySelector(":scope > span button"));
      const room = r(li.querySelector("summary [class*=coreIconRoom]"));
      const text = r(li.querySelector("summary [class*=itemText]"));
      const facts = r(li.querySelector("summary [class*=coreFacts]"));
      const gems = li.querySelector(":scope > [class*=coreGems]");
      const gemsBox = gems && getComputedStyle(gems).display !== "none" ? r(gems) : null;
      return {
        iconOnRoom: Math.abs(icon.left - room.left) <= 1 && Math.abs(icon.top - room.top) <= 1,
        iconInRow: icon.top >= summary.top - 1 && icon.bottom <= summary.bottom + 1,
        textClear: text.left >= icon.right,
        gemsClear: !gemsBox || gemsBox.left >= facts.right,
      };
    });
    expect(box).toEqual({ iconOnRoom: true, iconInRow: true, textClear: true, gemsClear: true });
    // The row still opens from its text, and the cards stay on top once it is open.
    await row.locator("summary [class*=itemText]").click();
    await expect(row.locator("details")).toHaveAttribute("open", "");
    await row.evaluate((li) => li.scrollIntoView({ block: "center" })); // clear of the sticky header
    expect(await topmost(), "펼친 줄").toEqual({ icon: true, gems: true });
  });
