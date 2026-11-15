// 회귀(사용자 11-12): 보석 · 장신구는 따로 된 위 탭이 아니라 거래소 분류와 같은 한 줄(재련 재료 … + 보석 + 장신구)에
// 있다. 거래소 분류는 그 자리에서 바뀌고, 보석 · 장신구는 자기 주소로 간다. 보석 · 장신구 화면에서도 같은 줄이
// 보이고(그 분류가 고른 상태), 거래소 분류를 누르면 시세 화면이 그 분류로 열린다. 위 탭은 '품목 시세' 하나가
// 세 화면을 맡는다. 첫 그림 흔들림 0, 320에서 넘침 없음.
// codex #1597: 줄의 항목은 갈 곳의 링크(새 탭으로 열기·링크 복사·스크립트 전에도 동작), 서버와 브라우저가 같은
// 11개 줄, 휴대폰에서 고른 항목이 첫 HTML부터 보인다(로드 뒤 옆으로 굴러오지 않음).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const row = (page) => page.getByRole("navigation", { name: "시세 분류" });
const hub = (page) => page.getByRole("navigation", { name: "시세 화면" });
// 장비 상자 is never in the row: the api's tab list leaves it out (PM 총괄 11-14).
const ROW = ["재련 재료", "재련 추가 재료", "아크 그리드 재료", "무기 진화 재료", "각인서", "생활", "전투 용품", "요리", "아바타", "보석", "장신구"];

for (const width of [320, 1280])
  test(`${width}: 보석 · 장신구가 시세 분류 줄 끝에 있고, 세 화면을 오간다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market");
    await expect(row(page).getByRole("link")).toHaveText(ROW);
    await expect(row(page).getByText("장비 상자")).toHaveCount(0);
    await expect(row(page).getByRole("link", { name: "보석", exact: true })).toHaveAttribute("href", "/market/gems");
    await expect(row(page).getByRole("link", { name: "각인서", exact: true })).toHaveAttribute("href", "/market?tab=ENGRAVING_BOOK");
    // One hub tab for the three pages; 보석 · 장신구 are no longer hub tabs.
    await expect(hub(page).getByRole("link", { name: "품목 시세", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(hub(page).getByRole("link", { name: "보석", exact: true })).toHaveCount(0);
    await expect(hub(page).getByRole("link", { name: "장신구", exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await row(page).getByRole("link", { name: "보석", exact: true }).click();
    await expect(page).toHaveURL(/\/market\/gems(\?|$)/);
    await expect(page.getByRole("heading", { level: 1, name: "보석 시세" })).toBeVisible();
    await expect(row(page).getByRole("link", { name: "보석", exact: true })).toHaveAttribute("aria-current", "page");
    // The same row as on /market.
    await expect(row(page).getByRole("link")).toHaveText(ROW);
    await expect(hub(page).getByRole("link", { name: "품목 시세", exact: true })).toHaveAttribute("aria-current", "page");

    await row(page).getByRole("link", { name: "각인서", exact: true }).click();
    await expect(page).toHaveURL(/\/market\?tab=ENGRAVING_BOOK/);
    await expect(row(page).getByRole("link", { name: "각인서", exact: true })).toHaveAttribute("aria-current", "page");

    await row(page).getByRole("link", { name: "장신구", exact: true }).click();
    await expect(page).toHaveURL(/\/market\/accessories(\?|$)/);
    await expect(page.getByRole("heading", { level: 1, name: "장신구 시세" })).toBeVisible();
    await expect(row(page).getByRole("link", { name: "장신구", exact: true })).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalOverflow(page);
  });

// codex #1597 P2-3: the categories are links again, so a new tab is the browser's own. On /market a plain press
// still switches in place; a Ctrl press opens the category in a new tab and leaves this page as it was.
test("분류는 링크: Ctrl로 누르면 새 탭에서 열리고 이 화면은 그대로 @regression", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market");
  const opened = context.waitForEvent("page");
  await row(page).getByRole("link", { name: "각인서", exact: true }).click({ modifiers: ["ControlOrMeta"] });
  const other = await opened;
  // A new tab starts at about:blank; wait for its own address (CI read it too early, #1597/#1601).
  await other.waitForURL(/\/market\?tab=ENGRAVING_BOOK$/);
  await expect(row(page).getByRole("link", { name: "재련 재료", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page).not.toHaveURL(/tab=ENGRAVING_BOOK/);
  await other.close();
});

// The chosen item, where it sits in the row: a late one (요리 · 보석 · 장신구) is past the right edge at 320.
const PAGES = [
  ["/market?tab=FOOD", "요리"],
  ["/market/gems", "보석"],
  ["/market/accessories", "장신구"],
];
// Is the chosen item inside the row's visible part, and how wide is the row (its list)?
const chosenInView = (page) =>
  row(page).evaluate((nav) => {
    const scroller = nav.firstElementChild;
    const chosen = nav.querySelector('[aria-current="page"]');
    const a = scroller.getBoundingClientRect();
    const b = chosen.getBoundingClientRect();
    return { name: chosen.textContent, inView: b.left >= a.left - 1 && b.right <= a.right + 1, width: nav.querySelector("ul").offsetWidth };
  });

test.describe("스크립트 없이(첫 HTML) @regression", () => {
  test.use({ javaScriptEnabled: false });
  for (const width of [320, 1280])
    for (const [path, name] of PAGES)
      test(`${width} ${path}: 첫 HTML부터 11개 줄, 고른 '${name}'이 보이고, 누르면 그 화면으로`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await expect(row(page).getByRole("link")).toHaveText(ROW);
        await expect(row(page).locator('[aria-current="page"]')).toHaveText(name);
        expect(await chosenInView(page)).toMatchObject({ name, inView: true });
        // Before any script: the link itself goes there.
        const next = name === "보석" ? ["장신구", /\/market\/accessories$/] : ["보석", /\/market\/gems$/];
        await row(page).getByRole("link", { name: next[0], exact: true }).click();
        await expect(page).toHaveURL(next[1]);
      });
});

for (const width of [320, 1280])
  for (const [path, name] of PAGES)
    test(`${width} ${path}: 깨어난 뒤에도 같은 줄·같은 폭, 고른 '${name}'은 그 자리(흔들림 0) @regression`, async ({ page, browser }, testInfo) => {
      // The same page without scripts: the server's HTML as drawn.
      const bare = await browser.newContext({ javaScriptEnabled: false, baseURL: testInfo.project.use.baseURL, viewport: { width, height: 800 } });
      const first = await bare.newPage();
      await first.goto(path);
      const served = await chosenInView(first);
      const scrolled = await row(first).evaluate((nav) => nav.firstElementChild.scrollLeft);
      await bare.close();

      await page.setViewportSize({ width, height: 800 });
      await watchShifts(page);
      await gotoReady(page, path);
      await expect(row(page).getByRole("link")).toHaveText(ROW);
      await page.waitForTimeout(500);
      expect(await chosenInView(page)).toEqual(served);
      // Nothing scrolled it after load: where the HTML put it.
      expect(await row(page).evaluate((nav) => nav.firstElementChild.scrollLeft)).toBe(scrolled);
      const { all, moved } = await shiftsSince(page);
      expect(all, `흔들림 (${moved})`).toBe(0);
      await expectNoHorizontalOverflow(page);
    });

// codex #1597 delta: Safari and Firefox lack scroll-initial-target. There the small inline script after the row
// sets its scroll as the HTML is parsed. Played here in Chromium: the CSS feature off (stylesheet and
// CSS.supports) and the app's own JS chunks answered empty (CSS untouched), so only the server's HTML and its
// inline scripts run. Console errors still fail the test: a script the CSP blocks or one that throws is caught.
test.describe("scroll-initial-target 없는 브라우저 흉내 @regression", () => {
  for (const [path, name] of PAGES.slice(1))
    test(`320 ${path}: 인라인 스크립트가 첫 그림 전에 고른 '${name}'을 보이게`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.addInitScript(() => {
        const supports = CSS.supports.bind(CSS);
        CSS.supports = (...args) => (String(args[0]).includes("scroll-initial-target") ? false : supports(...args));
      });
      await page.route(
        (url) => url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"),
        (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
      );
      await page.route(`**${path}`, async (route) => {
        const response = await route.fetch();
        const html = (await response.text()).replace("</head>", "<style>[aria-current=page]{scroll-initial-target:none!important}</style></head>");
        await route.fulfill({ response, body: html });
      });
      const blocked = [];
      page.on("console", (message) => message.text().includes("Content Security Policy") && blocked.push(message.text()));
      await page.goto(path);
      await expect(row(page).locator('[aria-current="page"]')).toHaveText(name);
      // The row's own script is there and ran under the CSP; the styles came (CSS chunks not touched).
      await expect(row(page).locator("script")).toHaveCount(1);
      expect(blocked, "CSP가 막은 스크립트").toEqual([]);
      expect(await row(page).evaluate((nav) => getComputedStyle(nav).borderRadius)).not.toBe("0px");
      expect(await chosenInView(page)).toMatchObject({ name, inView: true });
    });
});

// codex #1597 delta P3: a category the api does not open keeps its place and says so to a screen reader too.
test("api가 열지 않는 분류는 자리를 지키고 '볼 수 없음'으로 읽힌다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // The server draws the page without a tab list for this client (tests/mock-backend.mjs); the browser's own
  // read then answers without 아바타.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.180" });
  await page.route("**/api/markets/tabs*", async (route) => {
    const response = await route.fetch({ headers: { ...route.request().headers(), "x-forwarded-for": "203.0.113.1" } });
    const body = await response.json();
    body.envelope.data.tabs = body.envelope.data.tabs.filter((t) => t.tab !== "AVATAR");
    await route.fulfill({ response, json: body });
  });
  await page.goto("/market");
  const avatar = row(page).getByRole("link", { name: /^아바타/ });
  await expect(avatar).toHaveAttribute("aria-disabled", "true");
  await expect(avatar).toHaveAccessibleName("아바타 (지금 볼 수 없음)");
  await expect(row(page).getByRole("link")).toHaveCount(ROW.length);
});
