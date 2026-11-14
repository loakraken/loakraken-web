// 회귀(사용자 11-12, api #920): 시세 추이 기간은 1시간 · 7일 · 30일 · 3개월 · 1년(처음은 30일). 저장된 날이
// 모자라면 있는 날만 그리고 'N일치 기록'이라고 밝힌다(빈 날을 채우지 않음). 기간 조회 전 api(범위를 돌려주지
// 않음)면 지금처럼 1시간 · 7일 · 14일. 기간을 바꿔도 흔들림 0, 320에서 넘침 없음.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

// The day table as people see it (the 7일 skeleton and its unseen size copy are aria-hidden, #1634).
const REAL_ROWS = "table:not([aria-hidden]) tbody tr";
const detailOf = (page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "시세 추이" }) });

for (const width of [320, 1280])
  test(`${width}: 기간 1시간·7일·30일·3개월·1년, 모자란 기간은 있는 날만 'N일치 기록' @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
    const detail = detailOf(page);
    const ranges = detail.getByRole("group", { name: "기간" });
    await expect(ranges.getByRole("button")).toHaveText(["1시간", "7일", "30일", "3개월", "1년"]);
    await expect(ranges.getByRole("button", { name: "30일" })).toHaveAttribute("aria-pressed", "true");
    const caption = detail.getByText(/^하루 평균 거래가와 거래량/);
    // 30 days are all there (the mock keeps 45): no note.
    await expect(caption).toHaveText("하루 평균 거래가와 거래량");
    // 3개월: the mock has 39 completed days (45 kept, a 5-day hole, today partial), shown as they are and said.
    const moved = await shiftsDuring(page, () => ranges.getByRole("button", { name: "3개월" }).click(), 1500);
    await expect(caption).toHaveText("하루 평균 거래가와 거래량 · 3개월 중 39일치 기록");
    await expect(detail.getByText(/공식 거래소 일별 통계와 LOAKraken 저장 기록/)).toBeVisible();
    await expect(detail.getByText(/^3개월 [▲▼]?\d+\.\d%$/)).toBeVisible();
    expect(moved.all, `3개월 전환 흔들림 (${moved.moved})`).toBe(0);
    await ranges.getByRole("button", { name: "1년" }).click();
    await expect(caption).toHaveText("하루 평균 거래가와 거래량 · 1년 중 39일치 기록");
    // The table lists the latest 14 days at most, whatever the range.
    await expect(detail.locator(REAL_ROWS)).toHaveCount(14);
    await ranges.getByRole("button", { name: "7일" }).click();
    await expect(caption).toHaveText("하루 평균 거래가와 거래량");
    await expect(detail.locator(REAL_ROWS)).toHaveCount(7);
    await expectNoHorizontalOverflow(page);
  });

test("기간 조회 전 api(range 없음)면 1시간·7일·14일 그대로 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  // The web's own route answers { ok, envelope }; drop the #920 fields as an older api would.
  await page.route(/\/api\/markets\/items\/\d+\/history/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    delete body.envelope.data.range;
    for (const variant of body.envelope.data.variants) {
      delete variant.recordedSince;
      delete variant.storedDays;
      variant.days = variant.days.slice(0, 14);
    }
    await route.fulfill({ response, json: body });
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  // The first item came with the page (new api); another item is read through the old answer.
  await page.getByRole("region", { name: /각인서 시세/ }).getByRole("listitem").nth(1).getByRole("button").first().click();
  const ranges = detailOf(page).getByRole("group", { name: "기간" });
  await expect(ranges.getByRole("button")).toHaveText(["1시간", "7일", "14일"]);
  await expect(ranges.getByRole("button", { name: "14일" })).toHaveAttribute("aria-pressed", "true");
  await expect(detailOf(page).getByText("하루 평균 거래가와 거래량", { exact: true })).toBeVisible();
});

// api #920 (codex P2-1): for 30일+ the answer may also hold variants found only in stored history, after the
// official ones, with no trade terms (both null). They get their own button, never a second "1개".
test("기록에만 있는 거래 조건은 '지난 기록'으로 따로 고른다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=90d/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const [official] = body.envelope.data.variants;
    const days = official.days.filter((d) => !d.partial).slice(10, 30);
    body.envelope.data.variants.push({ ...official, tradeRemainCount: null, bundleCount: null, days, storedDays: days.length, recordedSince: days.at(-1).date });
    await route.fulfill({ response, json: body });
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  const detail = detailOf(page);
  await detail.getByRole("group", { name: "기간" }).getByRole("button", { name: "3개월" }).click();
  const terms = detail.getByRole("group", { name: "거래 조건" });
  await expect(terms.getByRole("button")).toHaveText(["1개", "지난 기록"]);
  await terms.getByRole("button", { name: "지난 기록" }).click();
  await expect(terms.getByRole("button", { name: "지난 기록" })).toHaveAttribute("aria-pressed", "true");
  // Its own stored days are 11–30 days old: the table lists those inside its 14-day window (3).
  await expect(detail.locator(REAL_ROWS)).toHaveCount(3);
  await expectNoHorizontalOverflow(page);
});

// codex #1595 P1: api #920 sends storedDays and recordedSince null when it reads no stored record (7d, 14d,
// no range at all = an older bundle). The web route checks the answer against the contract: null must pass.
test("저장 기록을 읽지 않은 답(storedDays·recordedSince null)도 웹 경로를 통과한다 @regression", async ({ page }) => {
  for (const query of ["?range=7d", "?range=14d", ""]) {
    const response = await page.request.get(`/api/markets/items/1234/history${query}`);
    expect(response.status(), `history${query}`).toBe(200);
    const body = await response.json();
    expect(body.ok, `history${query}`).toBe(true);
    expect(body.envelope.data.variants[0], `history${query}`).toMatchObject({ storedDays: null, recordedSince: null });
  }
});

// codex #1595 P2: a day with no record breaks the line (no line drawn across the gap), and while a longer range
// loads the chart shown stays (no loading box, no '0일치').
test("기록 없는 날은 선이 끊기고, 긴 기간을 읽는 동안 보던 차트가 그대로 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=90d/, async (route) => {
    await gate;
    await route.continue();
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  const detail = detailOf(page);
  const line = detail.locator("figure svg path.k-draw");
  const strokes = async () => ((await line.getAttribute("d")) ?? "").match(/M/g)?.length ?? 0;
  const caption = detail.getByText(/^하루 평균 거래가와 거래량/);
  await expect(caption).toHaveText("하루 평균 거래가와 거래량");
  expect(await strokes(), "30일: one line").toBe(1);
  await detail.getByRole("group", { name: "기간" }).getByRole("button", { name: "3개월" }).click();
  await page.waitForTimeout(500);
  await expect(line).toBeVisible();
  await expect(detail.getByText("추이를 불러오고 있어요")).toHaveCount(0);
  await expect(caption).toHaveText("하루 평균 거래가와 거래량");
  release();
  await expect(caption).toHaveText("하루 평균 거래가와 거래량 · 3개월 중 39일치 기록");
  // The mock's 5-day hole (20–24 days ago): two strokes, nothing drawn across it.
  await expect.poll(strokes, { message: "3개월: the line breaks at the hole" }).toBe(2);
});

// codex #1595 P2: 7일 reads the 30-day answer. With sparse records it shows the days of the last 7 calendar days
// only (not the last 7 rows, weeks old) and says how many there are.
test("7일은 최근 7일 날짜 안의 기록만, 모자라면 'N일치 기록' @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=30d/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const base = Date.parse(body.envelope.data.baseDate);
    const keep = new Set([0, 1, 5, 9, 15, 22]);
    for (const variant of body.envelope.data.variants)
      variant.days = variant.days.filter((d) => keep.has(Math.round((base - Date.parse(d.date)) / 86_400_000)));
    await route.fulfill({ response, json: body });
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  // The first item came with the page; another item is read through the thinned answer.
  await page.getByRole("region", { name: /각인서 시세/ }).getByRole("listitem").nth(1).getByRole("button").first().click();
  const detail = detailOf(page);
  await detail.getByRole("group", { name: "기간" }).getByRole("button", { name: "7일" }).click();
  await expect(detail.getByText(/^하루 평균 거래가와 거래량/)).toHaveText("하루 평균 거래가와 거래량 · 7일 중 2일치 기록");
  // Today (partial), 1 and 5 days ago: nothing from 9 days ago or older.
  await expect(detail.locator(REAL_ROWS)).toHaveCount(3);
});

// codex #1595 delta: a placeholder is labelled by the answer it is. 3개월 → 1시간 → 1년 (still loading) shows the
// 30-day answer, so its caption must not say '3개월 중 …'.
test("기간 전환 중 자리 데이터는 제 기간 이름으로(3개월 → 1시간 → 1년) @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=365d/, async (route) => {
    await gate;
    await route.continue();
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  const detail = detailOf(page);
  const ranges = detail.getByRole("group", { name: "기간" });
  const caption = detail.getByText(/^하루 평균 거래가와 거래량|^판매 최저가/);
  await ranges.getByRole("button", { name: "3개월" }).click();
  await expect(caption).toHaveText("하루 평균 거래가와 거래량 · 3개월 중 39일치 기록");
  await ranges.getByRole("button", { name: "1시간" }).click();
  await expect(caption).toHaveText(/^판매 최저가/);
  await ranges.getByRole("button", { name: "1년" }).click();
  await page.waitForTimeout(500);
  await expect(caption).toHaveText("하루 평균 거래가와 거래량");
  release();
  await expect(caption).toHaveText("하루 평균 거래가와 거래량 · 1년 중 39일치 기록");
});

// codex #1595 delta: 7일 with no record in its window keeps the chart's box (a message inside, same height) and
// says '0일치', so the caption and the table under it stay where they were. (The table itself lists the 7-day
// window's rows, so what is under the table may move up: that is the content changing, as on any range.)
test("7일 창에 기록이 없으면 같은 높이 상자에 안내, 캡션·표는 제자리 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=30d/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const base = Date.parse(body.envelope.data.baseDate);
    const keep = new Set([0, 9, 15]);
    for (const variant of body.envelope.data.variants)
      variant.days = variant.days.filter((d) => keep.has(Math.round((base - Date.parse(d.date)) / 86_400_000)));
    await route.fulfill({ response, json: body });
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  await page.getByRole("region", { name: /각인서 시세/ }).getByRole("listitem").nth(1).getByRole("button").first().click();
  const detail = detailOf(page);
  const figure = detail.locator("figure").first();
  await expect(detail.locator("figure svg path.k-draw")).toBeVisible();
  const caption = detail.getByText(/^하루 평균 거래가와 거래량/);
  // Page positions (the press on 7일 may scroll it into view).
  const place = async () => ({
    figure: await figure.evaluate((el) => el.getBoundingClientRect().height),
    caption: await caption.evaluate((el) => Math.round(el.getBoundingClientRect().top + scrollY)),
    table: await detail.locator("table:not([aria-hidden])").evaluate((el) => Math.round(el.getBoundingClientRect().top + scrollY)),
  });
  const before = await place();
  await detail.getByRole("group", { name: "기간" }).getByRole("button", { name: "7일" }).click();
  await expect(detail.getByText("최근 7일 기록이 없어요.")).toBeVisible();
  await expect(caption).toHaveText("하루 평균 거래가와 거래량 · 7일 중 0일치 기록");
  expect(await place(), "차트 상자 높이·캡션·표 자리").toEqual(before);
});

// codex #1635 P3 (PM call): a week with no day at all (not even today) says so inside the reserved 7-row place —
// no table header over blank space — at the 7-row height. codex #1645 (PM call): said once — the chart above keeps
// its empty frame (same height) with no second message. At 320, 360 and 1280.
for (const width of [320, 360, 1280])
  test(`${width}: 7일에 기록이 하루도 없으면 7줄 자리 안에 안내 한 번, 머리줄 없음 @regression`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=30d/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const base = Date.parse(body.envelope.data.baseDate);
    const keep = new Set([9, 15]);
    for (const variant of body.envelope.data.variants)
      variant.days = variant.days.filter((d) => keep.has(Math.round((base - Date.parse(d.date)) / 86_400_000)));
    await route.fulfill({ response, json: body });
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  await page.getByRole("region", { name: /각인서 시세/ }).getByRole("listitem").nth(1).getByRole("button").first().click();
  const detail = detailOf(page);
  await expect(detail.getByText(/^하루 평균 거래가와 거래량 · 30일 중 2일치 기록$/)).toBeVisible();
  await detail.getByRole("group", { name: "기간" }).getByRole("button", { name: "7일" }).click();
  // Older days exist (9 and 15 days ago), so the line also says where they are (ux-copy: the next step).
  const empty = detail.getByText("최근 7일 동안 거래 기록이 없어요. 30일을 고르면 지난 기록을 볼 수 있어요.");
  await expect(empty).toBeVisible();
  await expect(detail.locator("table:not([aria-hidden])")).toHaveCount(0);
  // The message fills the place the unseen 7-row table holds.
  const sizes = await empty.evaluate((p) => ({
    message: Math.round(p.getBoundingClientRect().height),
    sevenRows: Math.round(p.parentElement.querySelector("table[aria-hidden]").getBoundingClientRect().height),
  }));
  expect(Math.abs(sizes.message - sizes.sevenRows), `안내 ${sizes.message}px · 7줄 ${sizes.sevenRows}px`).toBeLessThanOrEqual(1);
  // One notice: the chart box is there at its height, empty.
  const chart = detail.locator("figure").first();
  await expect(chart).toBeVisible();
  expect((await chart.innerText()).trim(), "차트 자리는 빈 틀").toBe("");
  await expect(detail.getByText("최근 7일 기록이 없어요.")).toHaveCount(0);
  });

// #1630 (codex #1595 P3): 7일 pressed while the 30-day answer is still loading. The table's place takes the 7-row
// table's height at the press (inside the click's input window), so the answer landing moves nothing; before, the
// 14-row block stayed 502px and shrank when the answer came (a late shift, counted as CLS). #1634 (codex #1631
// P3): also when the week is sparse (3 rows: the place keeps 7 rows, none made up) and at 360; an error ends the
// wait with the problem message, not a stuck skeleton.
const pressSevenWhileLoading = async (page, width, answer) => {
  await page.setViewportSize({ width, height: 900 });
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=30d/, async (route) => {
    await gate;
    await answer(route);
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  // The first item came with the page; another one reads its history through the held answer.
  await page.getByRole("region", { name: /각인서 시세/ }).getByRole("listitem").nth(1).getByRole("button").first().click();
  const detail = detailOf(page);
  await expect(detail.getByText("추이를 불러오고 있어요")).toBeVisible();
  await detail.getByRole("group", { name: "기간" }).getByRole("button", { name: "7일" }).click();
  // The table's place: what follows the caption (the pending place, then the table).
  const caption = detail.getByText(/^하루 평균 거래가와 거래량/);
  const slot = () => caption.evaluate((el) => Math.round(el.nextElementSibling.getBoundingClientRect().height));
  // Past the click's input window: a change from here on is a counted shift.
  await page.waitForTimeout(700);
  const pending = await slot();
  release();
  return { detail, slot, pending };
};
const thin = (keep) => async (route) => {
  const response = await route.fetch();
  const body = await response.json();
  const base = Date.parse(body.envelope.data.baseDate);
  for (const variant of body.envelope.data.variants)
    variant.days = variant.days.filter((d) => keep.has(Math.round((base - Date.parse(d.date)) / 86_400_000)));
  await route.fulfill({ response, json: body });
};

for (const width of [320, 360, 1280])
  test(`${width}: 30일을 읽는 중 7일을 누르면 표 자리가 그때 7줄 높이, 답이 와도 그대로 @regression`, async ({ page }) => {
    const { detail, slot, pending } = await pressSevenWhileLoading(page, width, (route) => route.continue());
    await expect(detail.locator(REAL_ROWS)).toHaveCount(7);
    await expect(detail.getByText("추이를 불러오고 있어요")).toHaveCount(0);
    const landed = await slot();
    expect(Math.abs(landed - pending), `표 자리 ${pending}px → 표 ${landed}px`).toBeLessThanOrEqual(1);
  });

test("360: 7일 기록이 드물어(3줄) 답이 와도 표 자리는 7줄 그대로, 빈 행은 만들지 않음 @regression", async ({ page }) => {
  // Today (partial), 1 and 5 days ago in the 7-day window; the rest weeks old.
  const { detail, slot, pending } = await pressSevenWhileLoading(page, 360, thin(new Set([0, 1, 5, 9, 15, 22])));
  await expect(detail.locator(REAL_ROWS)).toHaveCount(3);
  await expect(detail.getByText("추이를 불러오고 있어요")).toHaveCount(0);
  const landed = await slot();
  expect(Math.abs(landed - pending), `표 자리 ${pending}px → ${landed}px (3줄)`).toBeLessThanOrEqual(1);
  // The rows people see are the three days only.
  await expect(detail.getByRole("table").getByRole("row")).toHaveCount(4);
});

test.describe(() => {
  test.use({ allowConsoleErrors: true });
  test("360: 7일을 기다리다 오류가 나면 자리 표시 대신 오류 안내 @regression", async ({ page }) => {
    const { detail } = await pressSevenWhileLoading(page, 360, (route) =>
      route.fulfill({ status: 503, json: { ok: false, error: { code: "MARKET_CACHE_UNAVAILABLE", status: 503 } } }),
    );
    await expect(detail.getByText("추이를 불러오고 있어요")).toHaveCount(0);
    await expect(detail.getByRole("button", { name: /다시/ })).toBeVisible();
    await expect(detail.locator("table")).toHaveCount(0);
  });
});

// #1634 (codex #1631 P3): each day's cells stay on one line at 320 (a long price, today's label), so a row is
// never taller than the skeleton's.
test("320: 일별 표의 날짜 · 가격 · 거래량은 한 줄, 가로 넘침 없음 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=30d/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    // The widest values we allow (PM cap, codex #1654): price 9,999,999.99G and volume 99,999,999 on every day —
    // far above real days, so a font build that draws digits a little wider still fits.
    for (const variant of body.envelope.data.variants)
      for (const day of variant.days) Object.assign(day, { averagePrice: 9_999_999.99, tradeCount: 99_999_999 });
    await route.fulfill({ response, json: body });
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  await page.getByRole("region", { name: /각인서 시세/ }).getByRole("listitem").nth(1).getByRole("button").first().click();
  const detail = detailOf(page);
  await expect(detail.locator(REAL_ROWS)).toHaveCount(14);
  await expect(detail.locator(`${REAL_ROWS}[data-partial]`)).toHaveCount(1);
  const heights = await detail.locator(REAL_ROWS).evaluateAll((rows) => rows.map((r) => Math.round(r.getBoundingClientRect().height)));
  expect(new Set(heights).size, `행 높이 ${heights.join(",")}`).toBe(1);
  await expectNoHorizontalOverflow(page);
  // codex #1635 P3: inside the detail panel too, not only the page (a clipped panel could hide a long price).
  // Room to spare inside the panel's content box (codex #1654: 1–2px was fragile across font builds). The table is
  // 100% wide, so its last cell always ends at the edge; the room is the content box's width minus the narrowest
  // the table can be with these values (its min-content width, read with the width set aside for one sync layout).
  const room = await detail.evaluate((panel) => {
    const style = getComputedStyle(panel);
    const content = panel.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const table = panel.querySelector("table:not([aria-hidden])");
    const before = table.style.width;
    table.style.width = "min-content";
    const needed = table.getBoundingClientRect().width;
    table.style.width = before;
    const cells = [...table.querySelectorAll("th, td")];
    return {
      slack: content - needed,
      past: cells.filter((cell) => cell.getBoundingClientRect().right > panel.getBoundingClientRect().right - parseFloat(style.paddingRight) + 0.5).length,
      clipped: cells.filter((cell) => cell.scrollWidth > cell.clientWidth + 1).map((cell) => cell.textContent.trim()),
    };
  });
  expect(room.past, "패널 내용 상자 밖으로 나간 칸").toBe(0);
  test.info().annotations.push({ type: "slack", description: `${room.slack.toFixed(1)}px` });
  expect(room.clipped, "칸 안에서 잘린 글자").toEqual([]);
  expect(room.slack, `패널 내용 상자까지 남은 폭 ${room.slack.toFixed(1)}px`).toBeGreaterThanOrEqual(4);
});

// codex #1629 P3: the lone-day marker (#1628) is for a by-date day between two gaps only — never on the minute
// chart, and not on a chart of a single reading (its end dot is the reading).
test("1시간 차트에는 하루 점이 없다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market");
  const detail = detailOf(page);
  await detail.getByRole("group", { name: "기간" }).getByRole("button", { name: "1시간" }).click();
  await expect(detail.getByRole("img", { name: /^최근 1시간 판매 최저가/ })).toBeVisible();
  await expect(detail.locator("circle[data-lone]")).toHaveCount(0);
});

test("기록 하나뿐인 차트에는 하루 점이 없다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Today (partial) and yesterday: one completed day to draw.
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=30d/, thin(new Set([0, 1])));
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  // The first item came with the page; another one reads its history through the thinned answer.
  await page.getByRole("region", { name: /각인서 시세/ }).getByRole("listitem").nth(1).getByRole("button").first().click();
  const detail = detailOf(page);
  await expect(detail.getByText(/^하루 평균 거래가와 거래량 · 30일 중 1일치 기록$/)).toBeVisible();
  await expect(detail.getByRole("img", { name: /^일 평균 거래가와 거래량/ })).toBeVisible();
  await expect(detail.locator("circle[data-lone]")).toHaveCount(0);
});
