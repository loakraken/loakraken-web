// #1609: a few checks on real WebKit (Safari engine) at phone size, where the site takes a different path.
// Runs in the opt-in 'webkit-phone' project (E2E_WEBKIT=1, the CI 'e2e webkit' job) by the @webkit tag, and in the
// usual Chromium projects as well.
//
// 시세 분류 줄(codex #1597): Safari has no `scroll-initial-target`, so the small inline script after the row puts
// the chosen category in view while the HTML is parsed. In Chromium this path is only emulated
// (market-category-row.spec.mjs); here it is the browser's own. The chosen item is in view from the first paint,
// stays where it is after the page wakes, and nothing shifts.
//
// 캐릭터 화면 패널 건너뛰기(#1590, Safari without overflow-anchor) gets its @webkit check when #1590 lands.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const row = (page) => page.getByRole("navigation", { name: "시세 분류" });
const PAGES = [
  ["/market?tab=FOOD", "요리"],
  ["/market/gems", "보석"],
  ["/market/accessories", "장신구"],
];
const chosenInView = (page) =>
  row(page).evaluate((nav) => {
    const scroller = nav.firstElementChild;
    const chosen = nav.querySelector('[aria-current="page"]');
    const a = scroller.getBoundingClientRect();
    const b = chosen.getBoundingClientRect();
    const r = nav.getBoundingClientRect();
    return {
      name: chosen.textContent,
      inView: b.left >= a.left - 1 && b.right <= a.right + 1,
      scrollLeft: Math.round(scroller.scrollLeft),
      // The row's own box (page coordinates): WebKit has no layout-shift entries, so this is the shift check there.
      box: [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)].join(" "),
    };
  });

for (const width of [320, 390])
  for (const [path, name] of PAGES)
    test(`${width} ${path}: 고른 '${name}'이 첫 그림부터 시세 분류 줄 안에 보이고, 깨어난 뒤에도 그 자리 @regression @webkit`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await watchShifts(page);
      // As soon as the row is in the document: the first paint's state, before the app's scripts wake it.
      await page.goto(path, { waitUntil: "commit" });
      await expect(row(page).locator('[aria-current="page"]')).toHaveText(name);
      const first = await chosenInView(page);
      expect(first, "첫 그림에서 고른 항목이 보임").toMatchObject({ name, inView: true });
      // Woken: the same place, the row not scrolled again, nothing moved.
      await page.waitForFunction(() => Object.keys(document.body).some((key) => key.startsWith("__reactFiber$")));
      await page.waitForLoadState("load");
      expect(await chosenInView(page), "깨어난 뒤에도 같은 자리").toEqual(first);
      // Where the browser reports layout shifts (Chromium), none at all; WebKit has none to report, and the row's
      // box compared above is the check there.
      if (await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes("layout-shift"))) {
        const { all, moved } = await shiftsSince(page);
        expect(all, `흔들림 (${moved})`).toBe(0);
      }
      await expectNoHorizontalOverflow(page);
    });
