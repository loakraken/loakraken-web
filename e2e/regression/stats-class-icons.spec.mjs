// 회귀(통계 A1): 통계의 직업 줄마다 공식 직업 아이콘(공식 CDN의 SVG). 공식 파일이 압축 없이 3~20KB라
// 화면에 들어온 줄의 아이콘만 받고(아래 줄은 내려야 받음), 데이터 절약 모드에서는 받지 않는다. 아이콘은
// 고정 상자라 줄이 움직이지 않고, 이름 옆이라 화면 낭독에서는 건너뛴다(행 머리 이름 = 직업 이름).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const TABLES = [
  { path: "/stats", table: "직업별 인원과 전투력 분포" },
  { path: "/stats?tab=best", table: "직업별 최고 전투력" },
];
const ICON = /^https:\/\/cdn-lostark\.game\.onstove\.com\/2018\/obt\/assets\/images\/common\/class\/[a-z_]+\.svg$/;

const read = (rows) =>
  rows.evaluateAll((ths) =>
    ths.map((th) => {
      const box = th.querySelector("[aria-hidden]")?.getBoundingClientRect();
      const icon = th.querySelector("img");
      return {
        name: th.textContent.trim(),
        top: box ? box.top : null,
        size: box ? [Math.round(box.width), Math.round(box.height)] : null,
        src: icon?.getAttribute("src") ?? null,
        alt: icon?.getAttribute("alt") ?? null,
      };
    }),
  );

for (const width of [320, 1280])
  for (const { path, table } of TABLES)
    test(`@직업아이콘 ${width} ${table}: 화면 안 줄만 공식 아이콘, 이름은 그대로, 흔들림 0 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, path);
      const rows = page.getByRole("table", { name: table }).getByRole("rowheader");
      await expect(rows.first()).toBeVisible();
      await page.waitForTimeout(600);
      // Every row holds its 20×20 box from the first frame, icon or not; rows
      // well below the screen (on a phone the whole table can be) are not asked for yet.
      const first = await read(rows);
      expect(first.length).toBeGreaterThan(0);
      for (const cell of first) {
        expect(cell.size, cell.name).toEqual([20, 20]);
        if (cell.top > 900 + 300) expect(cell.src, cell.name).toBeNull();
      }
      const { all, moved } = await shiftsSince(page);
      expect(all, `흔들림 (${moved})`).toBe(0);
      await expectNoHorizontalOverflow(page);
      // The table on screen: its rows show the official icon, decorative.
      await rows.first().scrollIntoViewIfNeeded();
      await expect(rows.first().locator("img")).toHaveAttribute("src", ICON);
      const onScreen = async () => (await read(rows)).filter((cell) => cell.top >= 0 && cell.top <= 900 - 40);
      await expect
        .poll(async () => (await onScreen()).filter((cell) => !ICON.test(cell.src ?? "") || cell.alt !== "").map((cell) => cell.name))
        .toEqual([]);
      expect((await onScreen()).length).toBeGreaterThan(0);
      // The icon adds nothing to what a screen reader reads for the row.
      await expect(rows.first()).toHaveAccessibleName(first[0].name);
      // Scrolled to, the last row gets its icon.
      await rows.last().scrollIntoViewIfNeeded();
      await expect(rows.last().locator("img")).toHaveAttribute("src", ICON);
    });

test("@직업아이콘 데이터 절약 모드에서는 아이콘을 받지 않고 글자로 보인다 @regression", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: true } }));
  const asked = [];
  page.on("request", (r) => r.url().includes("/common/class/") && asked.push(r.url()));
  await gotoReady(page, "/stats");
  const rows = page.getByRole("table", { name: "직업별 인원과 전투력 분포" }).getByRole("rowheader");
  // The letters come when the row is near, as an icon would: bring it on screen first.
  await rows.first().scrollIntoViewIfNeeded();
  await expect(rows.first().locator("[data-chip]")).toBeVisible();
  await expect(rows.locator("img")).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(asked).toEqual([]);
});
