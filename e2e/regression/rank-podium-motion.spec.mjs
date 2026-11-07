// 회귀(사용자 11-08): 시상대 메달 테두리는 끝없이 돈다(1위 금, 2·3위 은·동은 더 조용히). 그래서
// (WCAG 2.2.2) 멈춤 단추가 있다: 키보드로 닿고, 이 브라우저에 기억된다. 화면 밖·숨은 탭에서는 쉬고,
// 줄인 동작에서는 돌지 않는다. CPU 4배 느리게 해도 긴 작업(50ms 넘는 일)이 없다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const podiumOf = (page) => page.locator("[data-rank-podium]");
const beamStates = (page) => podiumOf(page).evaluate((root) => document.getAnimations()
  .filter((a) => a.effect?.target instanceof Element && a.effect.target.closest("[data-podium-beam]") && root.contains(a.effect.target))
  .map((a) => a.playState));

test("멈춤 단추: 키보드로 멈추고 다시 켜며, 새로고침 뒤에도 기억 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await gotoReady(page, "/rankings");
  await expect(podiumOf(page)).toHaveAttribute("data-podium-state", "ready");
  expect(await beamStates(page)).toEqual(["running", "running", "running"]);
  const toggle = page.getByRole("button", { name: "시상대 효과 멈춤" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  const resume = page.getByRole("button", { name: "시상대 효과 켜기" });
  // 이름이 하는 일을 말한다(멈춤 ↔ 켜기): 이름과 눌림 상태를 함께 바꾸면 화면 낭독기가 두 번 뒤집어 읽는다.
  await expect(resume).toBeVisible();
  await expect(resume).not.toHaveAttribute("aria-pressed");
  await expect.poll(() => beamStates(page)).toEqual(["paused", "paused", "paused"]);
  expect(await page.evaluate(() => localStorage.getItem("loakraken-podium-motion"))).toBe("paused");
  await page.reload();
  await expect(podiumOf(page)).toHaveAttribute("data-podium-state", "ready");
  await expect(page.getByRole("button", { name: "시상대 효과 켜기" })).toBeVisible();
  await expect.poll(() => beamStates(page)).toEqual(["paused", "paused", "paused"]);
  await page.getByRole("button", { name: "시상대 효과 켜기" }).click();
  await expect.poll(() => beamStates(page)).toEqual(["running", "running", "running"]);
  expect(await page.evaluate(() => localStorage.getItem("loakraken-podium-motion"))).toBeNull();
});

test("화면 밖에서는 쉬고, 돌아오면 다시 돈다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await gotoReady(page, "/rankings");
  await expect(podiumOf(page)).toHaveAttribute("data-podium-state", "ready");
  await podiumOf(page).scrollIntoViewIfNeeded();
  expect(await beamStates(page)).toEqual(["running", "running", "running"]);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(podiumOf(page)).toHaveAttribute("data-offscreen", "");
  await expect.poll(() => beamStates(page)).toEqual(["paused", "paused", "paused"]);
  await podiumOf(page).scrollIntoViewIfNeeded();
  await expect(podiumOf(page)).not.toHaveAttribute("data-offscreen", "");
  await expect.poll(() => beamStates(page)).toEqual(["running", "running", "running"]);
});

test("CPU 4배 느리게: 테두리가 도는 동안 긴 작업 없음 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await gotoReady(page, "/rankings");
  await expect(podiumOf(page)).toHaveAttribute("data-podium-state", "ready");
  await podiumOf(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500); // first paint work (rolling digits) settled
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const long = await page.evaluate(() => new Promise((resolve) => {
    const seen = [];
    const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) seen.push(Math.round(entry.duration)); });
    observer.observe({ type: "longtask" });
    setTimeout(() => { observer.disconnect(); resolve(seen); }, 3000);
  }));
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  expect(long, "긴 작업(ms)").toEqual([]);
  expect(await beamStates(page)).toEqual(["running", "running", "running"]);
});
