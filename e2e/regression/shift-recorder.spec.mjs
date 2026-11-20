// 회귀(PM-프론트 #1774 P3): 흔들림 기록(support/shifts.mjs)이 그때 페이지 상태를 읽다가 오류가 나도 흔들림 자체는
// 남는다(빠지면 흔들림 검사가 조용히 통과). 글꼴 목록 읽기가 오류를 내게 하고 흔들림을 일부러 만든다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

test("흔들림 기록: 페이지 상태를 읽다 오류가 나도 흔들림은 남고 이유가 적힌다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    Object.defineProperty(document.fonts, Symbol.iterator, {
      configurable: true,
      value() {
        throw new Error("글꼴 목록 읽기 실패(검사용)");
      },
    });
  });
  await watchShifts(page);
  await gotoReady(page, "/market/quote");
  await page.waitForTimeout(300);
  // A box put at the top of main after load: everything below moves 24px.
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.style.height = "24px";
    document.querySelector("main")?.prepend(box);
  });
  // The observer reports on its own schedule: wait for the entry rather than a fixed time (5 s at most).
  await expect.poll(async () => (await shiftsSince(page)).all, { message: "일부러 만든 흔들림이 기록되지 않음", timeout: 5000 }).toBeGreaterThan(0);
  expect((await shiftsSince(page)).moved).toContain("상태 읽기 실패: 글꼴 목록 읽기 실패(검사용)");
});
