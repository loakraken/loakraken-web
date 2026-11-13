// 회귀(사용자 11-12): 보석 · 장신구는 따로 된 위 탭이 아니라 거래소 분류와 같은 한 줄(재련 재료 … + 보석 + 장신구)에
// 있다. 거래소 분류는 그 자리에서 바뀌고, 보석 · 장신구는 자기 주소로 간다. 보석 · 장신구 화면에서도 같은 줄이
// 보이고(그 분류가 고른 상태), 거래소 분류를 누르면 시세 화면이 그 분류로 열린다. 위 탭은 '품목 시세' 하나가
// 세 화면을 맡는다. 첫 그림 흔들림 0, 320에서 넘침 없음.
// codex #1597: 줄의 항목은 갈 곳의 링크(새 탭으로 열기·링크 복사·스크립트 전에도 동작), 서버와 브라우저가 같은
// 12개 줄, 휴대폰에서 고른 항목이 첫 HTML부터 보인다(로드 뒤 옆으로 굴러오지 않음).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const row = (page) => page.getByRole("navigation", { name: "시세 분류" });
const hub = (page) => page.getByRole("navigation", { name: "시세 화면" });
const ROW = ["재련 재료", "재련 추가 재료", "아크 그리드 재료", "무기 진화 재료", "각인서", "생활", "전투 용품", "요리", "아바타", "장비 상자", "보석", "장신구"];

for (const width of [320, 1280])
  test(`${width}: 보석 · 장신구가 시세 분류 줄 끝에 있고, 세 화면을 오간다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market");
    await expect(row(page).getByRole("link")).toHaveText(ROW);
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
  await other.waitForLoadState("domcontentloaded");
  expect(other.url()).toMatch(/\/market\?tab=ENGRAVING_BOOK$/);
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
      test(`${width} ${path}: 첫 HTML부터 12개 줄, 고른 '${name}'이 보이고, 누르면 그 화면으로`, async ({ page }) => {
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
