// 회귀(#1866, PM 총괄 11-21 성능 점검): 생각하는 구슬(thinking-orbs)은 첫 그림 뒤에 받는다. 그때까지 같은 자리에 구슬의
// 정지 화면(SVG, 서버 HTML)이 서 있고, 캔버스가 받으면 같은 상자에서 이어 그린다 — 자리 그대로, 흔들림 0.
// 캐릭터 배너의 64px 구슬(초상화를 기다리는 동안)로 본다.
import { test, expect, characterPath } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const orbBox = (page) => page.getByRole("status", { name: "캐릭터 이미지를 준비하는 중" });

for (const width of [320, 1280])
  test(`${width}: 배너 구슬 — 서버 HTML의 정지 화면이 같은 64px 상자에서 캔버스로 이어지고 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    // Keep the portrait from arriving, so the banner stays in its waiting state with the orb.
    await page.route(/cdn-lostark\.game\.onstove\.com\/.*\.(png|webp|jpg)/, () => {});
    await page.goto(characterPath("상세"), { waitUntil: "commit" });
    const box = orbBox(page);
    await expect(box).toBeVisible();
    // The server's HTML: the still frame (svg) in each of the light / dark spans, 64×64.
    const still = await box.evaluate((el) => [...el.querySelectorAll("svg")].map((svg) => {
      const r = svg.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), paths: svg.querySelectorAll("path").length };
    }));
    expect(still.length, "정지 화면(밝은 · 어두운 두 장)").toBe(2);
    expect(still.every((s) => s.paths > 10)).toBe(true);
    const shown = await box.evaluate((el) => {
      const svg = [...el.querySelectorAll("svg")].find((s) => s.getClientRects().length > 0);
      const r = svg.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(shown).toMatchObject({ w: 64, h: 64 });
    // The library arrives: canvases take the same box, the still frames go.
    await expect(box.locator("canvas")).toHaveCount(2, { timeout: 15000 });
    await expect(box.locator("svg")).toHaveCount(0);
    const drawn = await box.evaluate((el) => {
      const canvas = [...el.querySelectorAll("canvas")].find((c) => c.getClientRects().length > 0);
      const r = canvas.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(drawn).toEqual(shown);
    await page.waitForTimeout(300);
    const { all, moved } = await shiftsSince(page, 0);
    expect(all, `흔들림 (${moved})`).toBe(0);
  });

test.describe("JS 없이", () => {
  test.use({ javaScriptEnabled: false });
  test("배너 구슬은 정지 화면으로 보인다(빈 캔버스 아님) @regression", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.route(/cdn-lostark\.game\.onstove\.com\/.*\.(png|webp|jpg)/, () => {});
    await page.goto(characterPath("상세"), { waitUntil: "commit" });
    const box = orbBox(page);
    await expect(box).toBeVisible();
    await expect(box.locator("svg path").first()).toBeAttached();
    await expect(box.locator("canvas")).toHaveCount(0);
  });
});
