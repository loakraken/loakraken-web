// 회귀(사용자 11-08): 소개(/about) 히어로에는 캐릭터 이름 칸과 '캐릭터 검색' 버튼이 없다. 검색은 머리글의
// 공용 검색(Ctrl K)이 맡고, 맨 아래 '캐릭터 검색' 단추도 그 검색을 연다. 홈 히어로의 검색칸은 그대로.
// 검색칸이 빠진 자리에 빈 틈이 없고, 히어로 안에 흔들림이 없다(320·390·1280).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const hero = (page) => page.locator('section[aria-labelledby="hero-heading"]');

/** Layout shifts of anything inside the /about hero (#intro), from the first paint on. */
async function watchHeroShifts(page) {
  await page.addInitScript(() => {
    window.__heroShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const inside = (entry.sources ?? []).filter((s) => {
          const el = s.node && (s.node.nodeType === 1 ? s.node : s.node.parentElement);
          return el?.closest?.("#intro");
        });
        if (inside.length) window.__heroShifts.push({ value: entry.value, nodes: inside.map((s) => String(s.node?.className ?? s.node?.nodeName)) });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

test.describe("소개 히어로 검색칸 없음 @regression", () => {
  for (const width of [320, 390, 1280]) {
    test(`${width}: 이름 칸·검색 버튼 없음, 빈 틈 없음, 히어로 흔들림 0`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await watchHeroShifts(page);
      await gotoReady(page, "/about");
      // Hydrated (the motion scope is on): everything the page adds after the first HTML is in.
      await expect(page.locator('[data-motion="on"]')).toHaveCount(1);

      await expect(hero(page).getByRole("textbox")).toHaveCount(0);
      await expect(hero(page).locator("form")).toHaveCount(0);
      await expect(hero(page).getByRole("button", { name: "캐릭터 검색" })).toHaveCount(0);
      await expect(hero(page).getByRole("link", { name: "캐릭터 화면 미리보기" })).toBeVisible();

      // No hole where the search was: the bot's caption is followed right by the preview link.
      const gap = await hero(page).evaluate((section) => {
        const caption = section.querySelector('[class*="orbCaption"]').getBoundingClientRect();
        const link = section.querySelector('[class*="exploreLink"]').getBoundingClientRect();
        return Math.round(link.top - caption.bottom);
      });
      expect(gap, "캡션과 미리보기 링크 사이").toBeGreaterThanOrEqual(0);
      expect(gap, "캡션과 미리보기 링크 사이").toBeLessThanOrEqual(60);

      // Read once the page has settled: nothing in the hero moved since the first paint
      // (a fixed wait proves an absence here, nothing is awaited).
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => window.__heroShifts), "히어로 안 흔들림").toEqual([]);
    });
  }

  test("1280: Ctrl K와 맨 아래 '캐릭터 검색'은 머리글의 공용 검색을 연다, 홈 검색칸은 그대로", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoReady(page, "/about");
    await expect(page.locator('[data-motion="on"]')).toHaveCount(1);
    // The shared search's field (in its dialog); closed, it leaves the page.
    const field = page.getByRole("combobox", { name: "캐릭터 이름" });

    await page.keyboard.press("Control+KeyK");
    await expect(field).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(field).toHaveCount(0);

    const closing = page.getByRole("main").getByRole("button", { name: "캐릭터 검색" });
    await expect(closing).toHaveCount(1);
    await expect(closing).toHaveAttribute("aria-haspopup", "dialog");
    await closing.scrollIntoViewIfNeeded();
    await closing.click();
    await expect(field).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(field).toHaveCount(0);
    await expect(closing, "닫으면 누른 단추로 돌아옴").toBeFocused();

    await gotoReady(page, "/");
    await expect(hero(page).getByRole("textbox", { name: "캐릭터 이름", exact: true })).toBeVisible();
    await expect(hero(page).getByRole("button", { name: "캐릭터 검색" })).toBeVisible();
  });
});
