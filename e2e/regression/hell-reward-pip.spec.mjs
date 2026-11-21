// 회귀(M52, PM 총괄 11-22): 지옥 · 나락 보상의 '작은 창'(Document Picture-in-Picture). 이 기능이 있는 브라우저에서만
// 단추가 보이고(첫 그림 전에 <html data-pip>, 나중에 나타나지 않아 흔들림 0), 누르면 작은 창에 페이지와 같은 결과가
// 뜬다(상태 하나, 따로 불러오지 않음). 페이지에서 바꾸면 작은 창도 바뀌고, 다시 누르거나 다른 화면으로 가면 닫힌다.
// 헤드리스 브라우저의 작은 창 대신, 같은 출처의 빈 창을 여는 requestWindow로 바꿔 그 창의 내용을 본다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const PRICES = "/api/markets/material-prices";

/** A Document PiP whose window is an ordinary same-origin popup the test can read. */
const withPip = (page) =>
  page.addInitScript(() => {
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: {
        requestWindow: async ({ width, height }) => window.open("", "_blank", `popup,width=${width},height=${height}`),
      },
    });
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
    await page.getByRole("link", { name: "홈으로" }).click();
    await gone;
    await expect(page).toHaveURL(/\/$/);
  });
