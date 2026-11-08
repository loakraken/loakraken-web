// 회귀(사용자 11-03): 404에는 왼쪽 위 영어 두 줄이 없다. 화면 읽기용 한국어 제목(h1)은 남고,
// 가운데 그림(4·유리 원·로고)과 홈 링크는 그대로다. 320·390·1280에서 흔들림 0, 가로 넘침 없음.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince } from "../support/shifts.mjs";

// A 404 page answers 404 by design; its resource error in the console is expected.
test.use({ allowConsoleErrors: true });

for (const width of [320, 390, 1280])
  test(`@A5 404 ${width}: 영어 줄 없음, 화면 읽기용 제목, 그림·홈 링크 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await watchShifts(page);
    const response = await page.goto("/없는-주소");
    expect(response?.status()).toBe(404);
    const main = page.locator("main#main");
    // The heading is there for screen readers but takes no visible room.
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("페이지를 찾을 수 없어요.");
    expect(await heading.evaluate((el) => { const r = el.getBoundingClientRect(); return r.width <= 1 && r.height <= 1; })).toBe(true);
    // No visible Latin text anywhere on the page (the two English lines are gone).
    const visible = await main.evaluate((root) => {
      const out = [];
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walk.nextNode(); node; node = walk.nextNode()) {
        const el = node.parentElement;
        const r = el.getBoundingClientRect();
        if (r.width > 1 && r.height > 1 && /[A-Za-z]/.test(node.textContent)) out.push(node.textContent.trim());
      }
      return out;
    });
    expect(visible, "보이는 영어 글").toEqual([]);
    await expect(main.locator("svg text")).toHaveText(["4", "4"]);
    await expect(page.getByRole("link", { name: "홈으로" })).toBeVisible();
    await page.waitForTimeout(1200); // past the first-visit rise (0.5 s delay + 0.5 s)
    await expectNoHorizontalOverflow(page);
    const shift = await shiftsSince(page);
    expect(shift.all, `404 흔들림 (${shift.moved})`).toBe(0);
  });
