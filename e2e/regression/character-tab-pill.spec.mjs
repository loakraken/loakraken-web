// 회귀: 캐릭터 탭 선택 표시(web #263). 선택 스타일 덮개가 현재 탭 자리로 잘려(clip-path) 보인다.
// 마우스는 200ms 미끄러지고, 키보드는 즉시(data-instant) 옮겨진다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

/** 덮개의 잘림 범위가 현재 탭(aria-current) 범위와 맞는지. */
async function pillMatchesCurrent(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="캐릭터 정보 탭"]');
    const active = nav?.querySelector('a[aria-current="page"]');
    const layer = nav?.querySelector('[aria-hidden="true"]');
    if (!nav || !active || !layer) return { ok: false, why: "요소 없음" };
    const m = getComputedStyle(layer).clipPath.match(/inset\(0px ([\d.]+)px 0px ([\d.]+)px/);
    if (!m) return { ok: false, why: getComputedStyle(layer).clipPath };
    const [right, left] = [Number(m[1]), Number(m[2])];
    const ok = Math.abs(left - active.offsetLeft) <= 1 && Math.abs(layer.offsetWidth - left - right - active.offsetWidth) <= 1;
    return { ok, pill: nav.dataset.pill, instant: layer.hasAttribute("data-instant"), left, active: active.offsetLeft };
  });
}

test.describe("캐릭터 탭 선택 표시 @regression", () => {
  test("처음부터 현재 탭에 맞고, 클릭하면 새 탭으로 옮겨 간다", async ({ page }) => {
    await gotoReady(page, characterPath("상세"));
    await expect.poll(async () => (await pillMatchesCurrent(page)).ok).toBe(true);
    expect((await pillMatchesCurrent(page)).pill).toBe("on");

    await page.getByRole("navigation", { name: "캐릭터 정보 탭" }).getByRole("link", { name: "통계", exact: true }).click();
    await expect(page).toHaveURL(/\?tab=stats$/);
    await expect.poll(async () => (await pillMatchesCurrent(page)).ok).toBe(true);
    expect((await pillMatchesCurrent(page)).instant, "마우스는 미끄러진다").toBe(false);
  });

  test("키보드로 옮기면 즉시 옮겨진다", async ({ page }) => {
    await gotoReady(page, characterPath("상세"));
    const link = page.getByRole("navigation", { name: "캐릭터 정보 탭" }).getByRole("link", { name: "스킬", exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\?tab=skills$/);
    await expect.poll(async () => (await pillMatchesCurrent(page)).ok).toBe(true);
    expect((await pillMatchesCurrent(page)).instant, "키보드는 즉시").toBe(true);
  });

  test("화면 폭이 바뀌어도 현재 탭에 맞는다", async ({ page }) => {
    await gotoReady(page, characterPath("상세", "avatars"));
    await page.setViewportSize({ width: 768, height: 1000 });
    await expect.poll(async () => (await pillMatchesCurrent(page)).ok).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await pillMatchesCurrent(page)).ok).toBe(true);
  });
});
