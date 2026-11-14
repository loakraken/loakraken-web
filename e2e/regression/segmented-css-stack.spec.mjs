// 회귀(QA 11-13 08시, P1): 느린 연결(1.6 Mbps, 150 ms)에서 /market/quote 360·375의 '가격 기준'이
// 한 줄로 그려졌다가, 글꼴이 정해진 뒤(약 4초) 재어 보고 세로로 쌓여 아래 카드를 88px 밀었다(CLS 0.145·0.153).
// 웹 글꼴은 display: optional이라 느린 첫 방문은 시스템 글꼴로 그려지고, 그 글꼴이 더 넓다.
// 이제 쌓을지는 라벨로 정한 폭과 컨테이너 쿼리(CSS)가 첫 그림 전에 정한다: 재고 나서 바꾸는 일이 없다.
// 같은 칸을 쓰는 아비도스 제작·생명의 기운·로아 상점도 함께(abidos-craft:108 flaky의 원인).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const PAGES = [
  ["/market/quote", "가격 기준"],
  ["/tools/abidos-craft", "시세 기준"],
  ["/tools/life-energy", "시세 기준"],
  ["/tools/loa-shop", "시세 기준"],
];

/** QA's slow connection: the web font misses its window, the system face draws the labels. */
async function slowNetwork(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
}

/** How the row is laid out, and how many labels are wider than their item's content box
 * (the label's own text box, not scrollWidth: the 44px tap area hangs outside each item). */
const layout = (group) =>
  group.evaluate((el) => ({
    flow: getComputedStyle(el).gridAutoFlow,
    cut: [...el.querySelectorAll('[data-slot="segmented-item"]')].filter((item) => {
      const range = document.createRange();
      range.selectNodeContents(item);
      const s = getComputedStyle(item);
      return range.getBoundingClientRect().width > item.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) + 0.5;
    }).length,
  }));

for (const [path, name] of PAGES)
  for (const width of [360, 375])
    test(`${width} ${path} 느린 연결: '${name}'은 처음부터 쌓인 채, 글꼴이 정해진 뒤에도 흔들림 0 @regression`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 800 });
      await slowNetwork(page);
      await watchShifts(page);
      await gotoReady(page, path);
      const group = page.getByRole("radiogroup", { name, exact: true });
      await expect(group).toBeVisible();
      // The font decision is over once document.fonts settles; QA saw the stack land ~4 s in.
      await page.evaluate(() => document.fonts.ready);
      // A window to see a late change (nothing should come), not a wait for a state.
      await page.waitForTimeout(1500);
      const shifts = await shiftsSince(page);
      expect({ ...(await layout(group)), shift: shifts.all }, `끝 모양(쌓임, 잘린 라벨 없음)·첫 로드 흔들림: ${shifts.moved}`).toEqual({
        flow: "row",
        cut: 0,
        shift: 0,
      });
    });

// The bound must not stack rows that fit: 390 (the common phone) keeps one row in every face,
// and no label is cut in it — on the slow connection (system face) and on the web font.
for (const slow of [true, false])
  test(`390 /market/quote ${slow ? "느린 연결(시스템 글꼴)" : "웹 글꼴"}: '가격 기준'은 한 줄, 잘린 라벨 없음 @regression`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 800 });
    if (slow) await slowNetwork(page);
    await gotoReady(page, "/market/quote");
    const group = page.getByRole("radiogroup", { name: "가격 기준", exact: true });
    await page.evaluate(() => document.fonts.ready);
    expect(await layout(group)).toEqual({ flow: "column", cut: 0 });
  });

// Items that are not plain text pass their labels: the roster sort (short names up to 400px,
// full names wider) stays one row of short names at 360, may stack its full names between,
// and never cuts a name.
for (const [width, flow] of [[360, "column"], [430, null], [1280, "column"]])
  test(`${width} 원정대 정렬: ${flow === "column" ? "한 줄" : "한 줄 또는 쌓임"}, 잘린 이름 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await gotoReady(page, characterPath("상세", "siblings"));
    const group = page.getByRole("radiogroup", { name: "원정대 정렬", exact: true });
    await expect(group).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const now = await layout(group);
    expect(now.cut, "잘린 이름").toBe(0);
    if (flow) expect(now.flow).toBe(flow);
  });

// A frame is a container, and a container has no width of its own content: inside a parent that
// sizes to its content it would collapse (codex #1569 P1: /market/alerts' auto column fell to ~24px).
test("1280 /market/alerts: '조건'은 한 줄, 칸이 줄지 않고 잘린 라벨 없음 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market/alerts");
  const group = page.getByRole("radiogroup", { name: "조건", exact: true });
  await expect(group).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await layout(group)).toEqual({ flow: "column", cut: 0 });
  // Two items with their 16px sides at least: a collapsed column is narrower than that.
  expect((await group.boundingBox()).width).toBeGreaterThan(150);
});

// The roster toolbar is the sort's container: the switches keep sharing its row (codex #1569 P2).
test("1280 원정대 정렬: 축약·닉네임 가리기가 정렬과 같은 줄 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, characterPath("상세", "siblings"));
  const sort = await page.getByRole("radiogroup", { name: "원정대 정렬", exact: true }).boundingBox();
  for (const name of ["축약", "닉네임 가리기"]) {
    const sw = await page.getByRole("switch", { name }).boundingBox();
    const middle = sw.y + sw.height / 2;
    expect(middle, `${name} 줄`).toBeGreaterThan(sort.y);
    expect(middle, `${name} 줄`).toBeLessThan(sort.y + sort.height);
  }
});

// Raid rows: one row where every face fits, stacked where one does not, never a cut label.
for (const width of [360, 375, 390])
  test(`${width} /tools/raid-rewards 느린 연결(시스템 글꼴): 난이도 칸은 잘린 라벨 없음 @regression`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    await slowNetwork(page);
    await gotoReady(page, "/tools/raid-rewards");
    await page.evaluate(() => document.fonts.ready);
    const groups = page.locator('[data-slot="segmented-control"]');
    expect(await groups.count()).toBeGreaterThan(0);
    for (const group of await groups.all()) expect((await layout(group)).cut, await group.getAttribute("aria-label")).toBe(0);
  });
