// 회귀(사용자 11-16): 가로로 넘치는 칩·탭 줄(예: /market 시세 분류)이 데스크톱에서 잘려, 나머지에 닿을 길이 없었다.
// 이제 모든 줄이 한 가지로 움직인다(components/ui/overflow-row.tsx):
// - 마우스에서는 가려진 쪽에만 ‹ › 단추('이전 항목' · '다음 항목'). 누르면 한 줄쯤 넘어가고 초점은 가져가지 않는다.
// - 마우스로 끌어 넘긴다. 몇 px 넘게 끌면 누름이 아니다(칩이 골라지지 않는다). 제자리 누름은 그대로 고른다.
// - 키보드로 닿은 칩은 끝 흐림 밖에 놓인다. 고른 칩은 첫 그림부터 보인다.
// - 휴대폰(터치)은 손가락으로 넘기고 단추는 없다. 동작 줄이기에서는 넘김이 바로 끝난다.
// - 단추는 잰 뒤 줄 위에 얹혀 칩을 밀지 않는다(흔들림 0).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince } from "../support/shifts.mjs";

const categories = (page) => page.getByRole("navigation", { name: "시세 분류" });
const prev = (row) => row.getByRole("button", { name: "이전 항목" });
const next = (row) => row.getByRole("button", { name: "다음 항목" });
// The box's first element child is the row that scrolls.
const scroll = (row) =>
  row.evaluate((box) => {
    const el = box.firstElementChild;
    return { left: Math.round(el.scrollLeft), width: el.clientWidth, max: el.scrollWidth - el.clientWidth };
  });

for (const width of [1024, 768])
  test(`${width} 마우스: 가려진 쪽에만 ‹ ›, 누르면 한 줄쯤 넘어가고 초점은 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/market");
    const row = categories(page);
    await expect(next(row)).toBeVisible();
    await expect(prev(row)).toBeHidden();
    const start = await scroll(row);
    expect(start.left).toBe(0);
    expect(start.max, "이 폭에서 줄이 넘쳐야 시험이 된다").toBeGreaterThan(40);

    await next(row).click();
    await expect.poll(async () => (await scroll(row)).left).toBe(Math.min(start.max, Math.round(Math.max(start.width * 0.8, 64))));
    await expect(prev(row)).toBeVisible();
    // A press never takes the focus (the keyboard reaches every item by Tab).
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null)).toBeNull();

    // To the end: › goes away, ‹ stays.
    for (let i = 0; i < 6 && (await next(row).isVisible()); i++) {
      await next(row).click();
      await page.waitForTimeout(500);
    }
    await expect(next(row)).toBeHidden();
    expect((await scroll(row)).left).toBe(start.max);
    await prev(row).click();
    await expect.poll(async () => (await scroll(row)).left).toBeLessThan(start.max);
    await expect(next(row)).toBeVisible();
  });

test("1280 줄이 다 보이면 단추는 없다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market");
  // The hub tabs (품목 시세 · 재료 견적) fit.
  const hub = page.locator("[data-overflow-row]").filter({ has: page.getByRole("navigation", { name: "시세 화면" }) });
  await expect(hub.getByRole("link", { name: "재료 견적" })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(prev(hub)).toBeHidden();
  await expect(next(hub)).toBeHidden();
});

test("1024 마우스로 끌어 넘기면 칩이 골라지지 않고, 제자리 누름은 고른다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await gotoReady(page, "/market");
  const row = categories(page);
  await expect(next(row)).toBeVisible();
  const asks = [];
  page.on("request", (request) => request.url().includes("/api/markets/") && asks.push(request.url()));

  // Pressed on a chip, dragged 240px to the left: the row follows the hand, nothing is chosen.
  const chip = row.getByRole("link", { name: "전투 용품" });
  const box = await chip.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 12; step++) await page.mouse.move(box.x + box.width / 2 - step * 20, box.y + box.height / 2);
  await page.mouse.up();
  const dragged = await scroll(row);
  expect(dragged.left).toBe(Math.min(240, dragged.max));
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/market$/);
  await expect(row.locator('[aria-current="page"]')).toHaveText("재련 재료");
  expect(asks.filter((url) => url.includes("BATTLE_ITEM")), "끌기 뒤 전투 용품을 불러옴").toEqual([]);
  expect(await page.evaluate(() => getSelection()?.toString() ?? "")).toBe("");

  // A press that moves less than the threshold is a click.
  const food = row.getByRole("link", { name: "요리" });
  const at = await food.boundingBox();
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.mouse.move(at.x + at.width / 2 + 3, at.y + at.height / 2);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/market\?tab=FOOD$/);
  await expect(row.locator('[aria-current="page"]')).toHaveText("요리");
});

test("1024 키보드로 닿은 칩은 끝 흐림 밖에 놓이고, 화면은 위아래로 움직이지 않는다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await gotoReady(page, "/market");
  const row = categories(page);
  await row.getByRole("link", { name: "재련 재료" }).focus();
  const y = await page.evaluate(() => scrollY);
  const names = await row.getByRole("link").allTextContents();
  for (const name of names.slice(1)) {
    await page.keyboard.press("Tab");
    const rest = await row.evaluate((box) => {
      const el = box.firstElementChild;
      const link = document.activeElement;
      const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
      const r = link.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      return {
        name: link.textContent.trim(),
        clear: r.left >= b.left + (el.scrollLeft > 1 ? pad : 0) - 1 && r.right <= b.right - (el.scrollLeft < el.scrollWidth - el.clientWidth - 1 ? pad : 0) + 1,
      };
    });
    expect(rest).toEqual({ name: name.trim(), clear: true });
  }
  expect(await page.evaluate(() => scrollY)).toBe(y);
});

test("1024 동작 줄이기: › 누름이 바로 끝나고 단추에 전환이 없다 @regression", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1024, height: 900 });
  await gotoReady(page, "/market");
  const row = categories(page);
  await expect(next(row)).toBeVisible();
  expect(await next(row).evaluate((button) => getComputedStyle(button).transitionDuration)).toMatch(/^0s(, 0s)*$/);
  const { width, max } = await scroll(row);
  await next(row).click();
  // Read at once: a smooth scroll would still be on its way.
  expect((await scroll(row)).left).toBe(Math.min(max, Math.round(Math.max(width * 0.8, 64))));
});

test("1024 단추가 나타나도 칩은 움직이지 않는다(흔들림 0) @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await watchShifts(page);
  await gotoReady(page, "/market?tab=AVATAR");
  const row = categories(page);
  await expect(prev(row)).toBeVisible();
  await page.waitForTimeout(500);
  const { all, moved } = await shiftsSince(page);
  expect(all, `흔들림 (${moved})`).toBe(0);
  // The chosen item is in view (it is past the row's end at this width).
  expect(
    await row.evaluate((box) => {
      const el = box.firstElementChild;
      const a = el.getBoundingClientRect();
      const b = box.querySelector('[aria-current="page"]').getBoundingClientRect();
      return el.scrollLeft > 0 && b.left >= a.left - 1 && b.right <= a.right + 1;
    }),
  ).toBe(true);
  await expectNoHorizontalOverflow(page);
});

test("360 터치: 단추 없이 손가락으로 넘기고, 고른 칩이 보인다 @regression", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 360, height: 780 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await gotoReady(page, "/market?tab=AVATAR");
  const row = categories(page);
  await expect(row.locator('[aria-current="page"]')).toHaveText("아바타");
  await page.waitForTimeout(300);
  await expect(row.getByRole("button")).toHaveCount(0);
  expect((await scroll(row)).left).toBeGreaterThan(0);
  await context.close();
});

test("360 시세·도구 묶음 탭: 고른 탭이 첫 그림부터 보인다(스크립트 없이도) @regression", async ({ browser }, testInfo) => {
  // The raid hub's last tab: past the row's end at 360.
  const path = "/tools/raid-cheatsheet";
  const inView = (page) =>
    page.getByRole("navigation", { name: "레이드 화면" }).evaluate((nav) => {
      const a = nav.getBoundingClientRect();
      const b = nav.querySelector('[aria-current="page"]').getBoundingClientRect();
      return { overflows: nav.scrollWidth > nav.clientWidth, inView: b.left >= a.left - 1 && b.right <= a.right + 1 };
    });
  for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 360, height: 780 }, javaScriptEnabled });
    const page = await context.newPage();
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "레이드 화면" }).locator('[aria-current="page"]')).toHaveText("컨닝페이퍼");
    if (javaScriptEnabled) await page.waitForLoadState("networkidle");
    expect(await inView(page), javaScriptEnabled ? "깨어난 뒤" : "서버 HTML(스크립트 없음)").toEqual({ overflows: true, inView: true });
    await context.close();
  }
});

// 넓은 글꼴(자간 0.12em, 서버 HTML에 넣어 첫 그림부터): 줄이 더 넘쳐도, 넘친 줄마다 › 가 있고, 페이지가 들어오는 동안
// 아무것도 움직이지 않으며, 화면은 가로로 넘치지 않는다.
const WIDE = "<style>body{letter-spacing:.12em!important}</style>";
for (const width of [1280, 360])
  test(`${width} 넓은 글꼴: 넘친 줄마다 ›, 흔들림 0, 화면 가로 넘침 없음 @regression`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") return route.fallback();
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace("</head>", `${WIDE}</head>`) });
    });
    // The log starts anew with each page.
    await watchShifts(page);
    for (const path of ["/market", "/market/quote", "/tools/raid-rewards", "/stats", "/rankings", "/character/%EC%83%81%EC%84%B8"]) {
      await gotoReady(page, path);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const rows = await page.locator("[data-overflow-row]").evaluateAll((boxes) =>
        boxes
          .filter((box) => box.getBoundingClientRect().width > 0)
          .map((box) => {
            const el = box.firstElementChild;
            const shown = (name) => {
              const button = box.querySelector(`:scope > button[aria-label="${name}"]`);
              return getComputedStyle(button).display !== "none";
            };
            return {
              row: (box.getAttribute("aria-label") || el.getAttribute("aria-label") || el.textContent).trim().slice(0, 20),
              hidden: el.scrollWidth > el.clientWidth + 1 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
              next: shown("다음 항목"),
            };
          }),
      );
      for (const r of rows) expect(r.next, `${path} ${r.row}: 끝 너머 항목 ${r.hidden ? "있음" : "없음"}`).toBe(r.hidden);
      const { all, moved } = await shiftsSince(page);
      expect(all, `${path} 흔들림 (${moved})`).toBe(0);
      await expectNoHorizontalOverflow(page);
    }
  });
