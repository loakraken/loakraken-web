// 회귀(사용자 제보 10-31): 통계 탭(직업 순위·분포·서버·전체 인구·칭호)을 왔다 갔다 하면 막대가
// 매번 0으로 줄었다가 다시 자라 차트가 움직여 보였다. 한 번 본 탭으로 돌아오면 막대는 제자리에
// 그대로 있고(자라는 효과는 그 탭을 처음 볼 때 1번), 아무것도 밀리지 않는다(A7).
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

/** Box of every bar in the open panel, and how many bar transitions are running. */
const bars = (page) =>
  page.locator("[role=tabpanel]").evaluate((panel) => {
    const parts = [...panel.querySelectorAll(".k-grow, .k-grow-x, .k-draw")];
    return {
      boxes: parts.slice(0, 12).map((el) => {
        const r = el.getBoundingClientRect();
        return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(",");
      }),
      running: parts.reduce((n, el) => n + el.getAnimations().filter((a) => a.playState === "running").length, 0),
    };
  });

for (const width of [1280, 360])
  test(`@A7 통계 탭 왔다 갔다: 막대 제자리 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    // Requests in flight: a tab's bars come with its answer, so its baseline waits for it.
    const inflight = new Set();
    page.on("request", (request) => inflight.add(request));
    page.on("requestfinished", (request) => inflight.delete(request));
    page.on("requestfailed", (request) => inflight.delete(request));
    await gotoReady(page, "/stats");
    const tabs = page.getByRole("tab");
    const count = await tabs.count();
    // First round: every tab shown once, its answer in, its bars drawn and settled
    // (a baseline taken before a slow answer had no bars, CI 11-01).
    const settled = [];
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveAttribute("aria-selected", "true");
      // Quiet twice in a row, 250 ms apart: a request that starts just after the click is not missed.
      let quiet = 0;
      await expect
        .poll(() => (quiet = inflight.size ? 0 : quiet + 1) >= 2, { message: "탭 응답 기다림", intervals: [250], timeout: 10_000 })
        .toBe(true);
      await expect.poll(async () => (await bars(page)).running, { timeout: 3000 }).toBe(0);
      settled.push((await bars(page)).boxes);
    }
    expect(settled.some((boxes) => boxes.length > 0), "막대가 있는 탭").toBe(true);
    // Back and forth: each tab shows its bars where they stood, from the first frame.
    for (const order of [[...Array(count).keys()].reverse(), [...Array(count).keys()]])
      for (const i of order) {
        const name = (await tabs.nth(i).textContent())?.trim();
        const moved = await shiftsDuring(
          page,
          async () => {
            await tabs.nth(i).click();
            await expect(tabs.nth(i)).toHaveAttribute("aria-selected", "true");
            const now = await bars(page);
            expect(now.running, `${name}: 다시 자라는 막대`).toBe(0);
            expect(now.boxes, `${name}: 막대 위치·크기 그대로`).toEqual(settled[i]);
          },
          600,
        );
        expect(moved.all, `${name}: 흔들림 (${moved.moved})`).toBe(0);
      }
  });
