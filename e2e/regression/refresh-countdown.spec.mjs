// 회귀(A6·A7): 캐릭터 탭 줄의 갱신 버튼은 남은 시간('3분 30초' → '3분 9초' → '갱신')이 바뀌어도
// 폭이 그대로라 옆의 분석·공유·즐겨찾기 버튼이 움직이지 않는다. 시계를 흘려 보내며 잰다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360])
  test(`@A7 갱신 버튼 남은 시간이 바뀌어도 폭·위치 그대로 @${width} @regression`, async ({ page }) => {
    await page.clock.install();
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    const refresh = page.locator("button[data-no-replay]").first();
    await expect(refresh).toContainText(/\d+분 \d+초|\d+초|갱신/);
    const box = async () => {
      const b = await refresh.boundingBox();
      return [Math.round(b.x), Math.round(b.width)];
    };
    // The page clock is faked (performance.now too): shifts are told by the running total.
    await page.waitForTimeout(500);
    let total = (await shiftsSince(page)).all;
    const first = await box();
    const labels = [await refresh.innerText()];
    // Through two-digit and one-digit seconds and minutes, down to "갱신".
    for (const step of [21_000, 60_000, 60_000, 60_000, 60_000]) {
      await page.clock.runFor(step);
      await page.waitForTimeout(300);
      labels.push(await refresh.innerText());
      const now = await shiftsSince(page);
      expect(+(now.all - total).toFixed(4), `남은 시간 ${labels.at(-1)} 흔들림 (${now.moved})`).toBe(0);
      total = now.all;
      expect(await box(), `갱신 버튼 위치·폭 (${labels.join(" → ")})`).toEqual(first);
    }
  });

// Every label the countdown can show fits the label's fixed width (the rate
// limit's "n초 뒤 갱신" only comes after a press and may widen the button).
const LABELS = ["갱신", "갱신 중", "10분 0초", "9분 59초", "59초"];
for (const theme of ["light", "dim", "dark"])
  for (const width of [1280, 360])
    test(`@A7 갱신 버튼 가장 긴 남은 시간도 고정 폭 안 ${theme} @${width} @regression`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("loakraken-theme", t), theme);
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, characterPath("상세"));
      const label = page.locator("button[data-no-replay] span[class*=refreshLabel]").first();
      const fits = await label.evaluate((el, texts) => {
        const min = parseFloat(getComputedStyle(el).minWidth);
        const probe = el.cloneNode();
        probe.style.cssText = "position:absolute;visibility:hidden;min-width:0;width:auto;white-space:nowrap";
        el.parentElement.append(probe);
        const out = texts.map((text) => {
          probe.textContent = text;
          return [text, Math.ceil(probe.getBoundingClientRect().width), Math.floor(min)];
        });
        probe.remove();
        return out;
      }, LABELS);
      for (const [text, natural, min] of fits) expect(natural, `'${text}' 폭 ${natural}px ≤ 고정 폭 ${min}px`).toBeLessThanOrEqual(min);
    });
