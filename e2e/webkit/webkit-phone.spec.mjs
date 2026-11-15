// #1609: checks on real WebKit (Safari engine) at phone size, where the site takes a different path. Only the
// opt-in 'webkit-phone' project runs this folder (E2E_WEBKIT=1, the CI job 'e2e webkit'); the Chromium shards
// never load it (codex #1649: no time added to them).
//
// 시세 분류 줄(codex #1597): Safari has no `scroll-initial-target`, so the small inline script after the row puts
// the chosen category in view while the HTML is parsed. The app's own JS chunks are held back while the first
// paint is sampled (codex #1649 P2): only the server's HTML and its inline scripts have run, so client code cannot
// repair a broken inline script before the check. Then the chunks are released, the page wakes, and the row must
// stay where it was.
//
// 캐릭터 화면 패널 건너뛰기(#1590, Safari without overflow-anchor) → #1648, after #1590 lands.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

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
      // The row's own box (page coordinates): WebKit has no layout-shift entries, so this is the shift check.
      box: [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)].join(" "),
    };
  });
const woken = (page) => page.evaluate(() => Object.keys(document.body).some((key) => key.startsWith("__reactFiber$")));

for (const width of [320, 390])
  for (const [path, name] of PAGES)
    test(`${width} ${path}: 고른 '${name}'이 앱 스크립트 전(서버 HTML + 인라인 스크립트)부터 줄 안에 보이고, 깨어난 뒤에도 그 자리 @webkit`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      // Hold the app's JS chunks until the first paint is sampled.
      let release;
      const gate = new Promise((resolve) => (release = resolve));
      await page.route(
        (url) => url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"),
        async (route) => {
          await gate;
          await route.continue();
        },
      );
      await page.goto(path, { waitUntil: "commit" });
      await expect(row(page).locator('[aria-current="page"]')).toHaveText(name);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      expect(await woken(page), "앱 스크립트 전에 잼").toBe(false);
      const first = await chosenInView(page);
      expect(first, "서버 HTML + 인라인 스크립트만으로 고른 항목이 보임").toMatchObject({ name, inView: true });
      // Woken: the same place, the row not scrolled again, nothing moved, nothing past the screen.
      release();
      await expect.poll(() => woken(page), { message: "앱이 깨어남" }).toBe(true);
      await page.waitForLoadState("load");
      expect(await chosenInView(page), "깨어난 뒤에도 같은 자리").toEqual(first);
      await expectNoHorizontalOverflow(page);
    });
