// 회귀(M52, PM 총괄 11-22): 지옥 · 나락 보상의 '작은 창'(Document Picture-in-Picture). 이 기능이 있는 브라우저에서만
// 단추가 보이고(첫 그림 전에 <html data-pip>, 나중에 나타나지 않아 흔들림 0), 누르면 작은 창에 페이지와 같은 결과가
// 뜬다(상태 하나, 따로 불러오지 않음). 페이지에서 바꾸면 작은 창도 바뀌고, 다시 누르거나 다른 화면으로 가면 닫힌다.
// 헤드리스 브라우저의 작은 창 대신, 같은 출처의 빈 창을 여는 requestWindow로 바꿔 그 창의 내용을 본다.
import { test, expect, gotoReady, chooseOption } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const PRICES = "/api/markets/material-prices";

/**
 * A Document PiP whose window is an ordinary same-origin popup the test can read. Like the real one, it opens only
 * while the press still counts as the user's (navigator.userActivation), else it refuses with NotAllowedError —
 * `refuse` makes it always refuse.
 */
const withPip = (page, { refuse = false } = {}) =>
  page.addInitScript((refuseAll) => {
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: {
        requestWindow: ({ width, height }) => {
          if (refuseAll || !navigator.userActivation.isActive)
            return Promise.reject(new DOMException("no user activation", "NotAllowedError"));
          const win = window.open("", "_blank", `popup,width=${width},height=${height}`);
          // The window's pagehide listeners, as the page adds and removes them (window.__pipHide.size).
          const hide = new Set();
          const add = win.addEventListener.bind(win);
          const remove = win.removeEventListener.bind(win);
          win.addEventListener = (type, fn, ...rest) => (type === "pagehide" && hide.add(fn), add(type, fn, ...rest));
          win.removeEventListener = (type, fn, ...rest) => (type === "pagehide" && hide.delete(fn), remove(type, fn, ...rest));
          window.__pipHide = hide;
          return Promise.resolve(win);
        },
      },
    });
  }, refuse);

/** Holds the JS chunk that carries the small window's view (its own style text marks it) for `ms`. */
const delayPipChunk = (page, ms) =>
  page.route(/\/_next\/static\/chunks\/.+\.js$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes("lk-pip-amount")) await new Promise((done) => setTimeout(done, ms));
    await route.fulfill({ response, body });
  });

/** No Document PiP (Firefox, Safari today). */
const withoutPip = (page) =>
  page.addInitScript(() => {
    for (const target of [window, Window.prototype]) {
      try {
        delete target.documentPictureInPicture;
      } catch {
        // not deletable
      }
    }
    if (typeof documentPictureInPicture !== "undefined")
      Object.defineProperty(window, "documentPictureInPicture", { configurable: true, value: undefined });
  });

test("320: 작은 창을 지원하지 않는 브라우저에는 단추가 없다 @regression", async ({ page }) => {
  await withoutPip(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoReady(page, "/tools/hell-reward");
  await expect(page.getByRole("heading", { name: /고정 보상$/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-pip"))).toBe(false);
  await expect(page.getByRole("button", { name: "작은 창" })).toBeHidden();
});

for (const width of [320, 1280])
  test(`${width}: 작은 창 — 단추는 첫 그림부터, 누르면 같은 결과, 페이지를 따라 바뀌고 따로 불러오지 않으며 닫힌다 @regression`, async ({ page }) => {
    await withPip(page);
    await watchShifts(page);
    const priceCalls = [];
    page.on("request", (request) => request.url().includes(PRICES) && priceCalls.push(request.url()));
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/tools/hell-reward");
    const button = page.getByRole("button", { name: "작은 창" });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    const best = page.locator("main dl[aria-live] dd").first();
    await expect(best).not.toHaveText("");
    // In the first HTML and shown before the first paint: nothing moved for it.
    await page.waitForTimeout(800);
    const shifts = await shiftsSince(page);
    expect(shifts.all, `첫 로드 흔들림: ${shifts.moved}`).toBe(0);

    // Open: the window shows the page's own result.
    const callsBefore = priceCalls.length;
    const opened = page.waitForEvent("popup");
    await button.click();
    const pip = await opened;
    await expect(button).toHaveAttribute("aria-pressed", "true");
    const pipTitle = pip.getByRole("heading", { level: 1 });
    const heading = await page.getByRole("heading", { name: /고정 보상$/ }).innerText();
    await expect(pipTitle).toHaveText(heading.replace(/ 고정 보상$/, ""));
    await expect(pip.locator("dl dd").first()).toHaveText(await best.innerText());
    await expect(pip.getByRole("list", { name: "상자별 값(좋은 순)" }).getByRole("listitem")).toHaveCount(
      await page.getByRole("list", { name: "상자별 값(좋은 순)" }).locator(":scope > li").count(),
    );
    // The page's styles came along (the window's own class is styled, not browser defaults).
    expect(await pip.locator("main").evaluate((el) => getComputedStyle(el).fontSize)).toBe("13px");
    // The page's own sentence about the order, and no row singled out (the page marks none; codex P2 on #1903).
    const pageNote = await page.getByText(/순서(예요|가 달라요|로 다시 정렬해요)\.$/).first().innerText();
    await expect(pip.getByText(pageNote, { exact: true })).toBeVisible();
    const weights = await pip.locator("ol > li").evaluateAll((items) => items.map((li) => getComputedStyle(li).fontWeight));
    expect(new Set(weights).size, `상자 줄 굵기 ${weights}`).toBe(1);

    // The page changes it: 나락 instead of 지옥 — the window follows in the same render.
    await page.getByRole("radiogroup", { name: "종류" }).getByRole("radio", { name: "나락" }).click();
    await expect(pipTitle).toHaveText(/^나락 /);
    await expect(pip.locator("dl dd").first()).toHaveText(await best.innerText());
    // One state source: opening it and changing the kind asked for no prices.
    expect(priceCalls.length, "작은 창이 따로 시세를 부르지 않음").toBe(callsBefore);

    // Pressed again: closed.
    const closed = pip.waitForEvent("close");
    await button.click();
    await closed;
    await expect(button).toHaveAttribute("aria-pressed", "false");

    // Leaving the tool closes it too.
    const again = page.waitForEvent("popup");
    await button.click();
    const second = await again;
    const gone = second.waitForEvent("close");
    // In-app navigation (the header's logo link, at every width): the tool unmounts and takes the window with it.
    await page.getByRole("link", { name: "LOAKraken 홈" }).click();
    await gone;
    await expect(page).toHaveURL(/\/$/);
  });

// codex P2 on #1903: the window is asked for in the click itself. Its code held 6s (past the ~5s a press counts as
// the user's) still opens it: asked after loading the code, the browser refused and the button did nothing.
test("1280: 작은 창 코드가 늦게 와도(6초) 누른 그 순간 창을 받아 연다 @regression", async ({ page }) => {
  test.setTimeout(60_000);
  await withPip(page);
  await delayPipChunk(page, 6000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/tools/hell-reward");
  const opened = page.waitForEvent("popup", { timeout: 3000 });
  await page.getByRole("button", { name: "작은 창" }).click();
  const pip = await opened;
  // Filled once the code is in.
  await expect(pip.getByRole("heading", { level: 1 })).toHaveText(/단계$/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "작은 창" })).toHaveAttribute("aria-pressed", "true");
});

// codex P2 on #1903: a refusal is said (a polite status line, the button offers to try again), never swallowed.
test("1280: 브라우저가 작은 창을 거절하면 알려 주고 다시 열 수 있다 @regression", async ({ page }) => {
  await withPip(page, { refuse: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/tools/hell-reward");
  let popups = 0;
  page.on("popup", () => popups++);
  await page.getByRole("button", { name: "작은 창" }).click();
  const retry = page.getByRole("button", { name: "다시 열기" });
  await expect(retry).toBeVisible();
  await expect(retry).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("status").filter({ hasText: "작은 창을 열지 못했어요. 다시 눌러 주세요." })).toHaveCount(1);
  expect(popups).toBe(0);
});

// codex P3s on #1903: leaving the tool while the window's code is still coming closes the window it already opened —
// at once, not when the code lands (held 8s here; the window must be gone well before).
test("1280: 작은 창을 여는 중에 화면을 떠나면 그 창이 바로 닫힌다 @regression", async ({ page }) => {
  test.setTimeout(60_000);
  await withPip(page);
  await delayPipChunk(page, 8000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/tools/hell-reward");
  const opened = page.waitForEvent("popup", { timeout: 3000 });
  await page.getByRole("button", { name: "작은 창" }).click();
  const pip = await opened;
  const gone = pip.waitForEvent("close", { timeout: 3000 });
  await page.getByRole("link", { name: "LOAKraken 홈" }).click();
  await expect(page).toHaveURL(/\/$/);
  await gone;
});

// codex P2 on #1903: the user closes the still-blank window while its code loads. The button must not stay 'open'
// on a closed window (it then only 'closed' it again, dead until a reload): it is free, and a new press opens anew.
test("1280: 코드를 받는 중에 빈 작은 창을 닫아도 단추는 살아 있고 다시 누르면 새 창이 열린다 @regression", async ({ page }) => {
  test.setTimeout(60_000);
  await withPip(page);
  await delayPipChunk(page, 2500);
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/tools/hell-reward");
  const button = page.getByRole("button", { name: "작은 창" });
  const opened = page.waitForEvent("popup", { timeout: 3000 });
  await button.click();
  const blank = await opened;
  await blank.close();
  // The code lands (2.5s) and finds the window closed: nothing is shown, the button stays unpressed.
  await page.waitForTimeout(3500);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  const again = page.waitForEvent("popup", { timeout: 3000 });
  await button.click();
  const pip = await again;
  await expect(pip.getByRole("heading", { level: 1 })).toHaveText(/단계$/);
  await expect(button).toHaveAttribute("aria-pressed", "true");
});

// codex P2 on #1903: a new 시세 기준 shows the old figures as not current on the page (busy, dimmed) — the window too.
test("1280: 시세 기준을 바꾸는 동안 작은 창도 '불러오는 중'이다 @regression", async ({ page }) => {
  await withPip(page);
  let release;
  const gate = new Promise((done) => (release = done));
  await page.route(`**${PRICES}`, async (route) => {
    if ((route.request().postData() ?? "").includes("CURRENT_MIN_PRICE")) await gate;
    await route.continue();
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/tools/hell-reward");
  await expect(page.locator("main dl[aria-live] dd").first()).not.toHaveText("");
  const opened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "작은 창" }).click();
  const pip = await opened;
  const pipMain = pip.locator("main");
  await expect(pipMain).not.toHaveAttribute("aria-busy");
  await chooseOption(page, page.getByRole("combobox", { name: "시세 기준" }), "현재 최저가");
  await expect(page.locator("[data-stale]")).toHaveCount(1);
  await expect(pipMain).toHaveAttribute("aria-busy", "true");
  release();
  await expect(page.locator("[data-stale]")).toHaveCount(0);
  await expect(pipMain).not.toHaveAttribute("aria-busy");
});

// codex P3 on #1903: the listener held on the window while its code loads is removed once the window is shown (only the
// view's own stays), and every listener is gone when it closes — opened normally, and closed while still loading.
test("1280: 작은 창의 pagehide 듣기는 보일 때 하나, 닫히면 0 @regression", async ({ page }) => {
  await withPip(page);
  await delayPipChunk(page, 1500);
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/tools/hell-reward");
  const button = page.getByRole("button", { name: "작은 창" });
  const listeners = () => page.evaluate(() => window.__pipHide?.size ?? -1);

  const opened = page.waitForEvent("popup");
  await button.click();
  const pip = await opened;
  await expect(pip.getByRole("heading", { level: 1 })).toHaveText(/단계$/);
  await expect.poll(listeners).toBe(1);
  const closed = pip.waitForEvent("close");
  await button.click();
  await closed;
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect.poll(listeners).toBe(0);

  // Closed by the user at once (shown already or still held, the code is cached now): either way nothing is left listening.
  const again = page.waitForEvent("popup");
  await button.click();
  const blank = await again;
  await blank.close();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect.poll(listeners).toBe(0);
});
