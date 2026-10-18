// 회귀(QA v0.3.1 최종 P2, 03:09 재현): 멀티서치 비교 → 아래로 내림 → 캐릭터 화면 → 뒤로. 휴대폰은 카드의
// '캐릭터 보기', 1280은 비교 표의 이름 링크. 돌아오면 명단과 스크롤 위치가 그대로이고, 받아 둔 결과가
// 곧바로 그려져 돌아오는 동안·뒤에 아무것도 움직이지 않는다(layout-shift 0, 입력 직후 포함).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const CASES = [
  { width: 360, height: 800, touch: true, open: (page) => page.getByRole("article", { name: "비교2" }).getByRole("link", { name: "캐릭터 보기" }) },
  { width: 390, height: 844, touch: true, open: (page) => page.getByRole("article", { name: "비교2" }).getByRole("link", { name: "캐릭터 보기" }) },
  { width: 1280, height: 900, touch: false, open: (page) => page.getByRole("region", { name: "캐릭터 비교 표" }).getByRole("link", { name: "비교2" }) },
];

for (const c of CASES)
  test.describe(`${c.width}×${c.height}`, () => {
    test.use({ viewport: { width: c.width, height: c.height }, hasTouch: c.touch });

    test(`멀티서치 ${c.width}: 캐릭터로 갔다 뒤로 오면 명단·스크롤 그대로, 흔들림 0 @regression`, async ({ page }) => {
      await page.addInitScript(() => {
        window.__shifts = [];
        window.__from = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            if (e.startTime >= window.__from)
              window.__shifts.push({
                v: e.value,
                src: e.sources.map((s) => {
                  const el = s.node?.nodeType === 1 ? s.node : s.node?.parentElement;
                  const cls = typeof el?.className === "string" ? el.className.split(" ")[0] : "";
                  return `${el?.tagName}.${cls} ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}`;
                }),
              });
        }).observe({ type: "layout-shift", buffered: true });
      });
      await gotoReady(page, "/multi-search");
      await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("비교1, 비교2 비교3");
      await page.getByRole("button", { name: "비교하기" }).click();
      const status = page.locator("main").getByText("3명을 비교하고 있어요");
      await expect(status).toBeVisible();
      const link = c.open(page);
      await link.scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(400);
      const before = await page.evaluate(() => Math.round(scrollY));
      expect(before, "아래로 내린 상태에서 시작").toBeGreaterThan(0);

      await link.click();
      await expect(page).toHaveURL(/\/character\/%EB%B9%84%EA%B5%902$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/비교2/);

      await page.evaluate(() => {
        window.__shifts = [];
        window.__from = performance.now();
      });
      await page.goBack();
      await expect(page).toHaveURL(/\/multi-search\?names=/);
      // The answers already received are back at once, not after a refetch.
      await expect(status).toBeVisible();
      await page.waitForTimeout(800);
      // Within a few pixels (the scroll restore rounds), from where the page was left.
      expect(Math.abs((await page.evaluate(() => Math.round(scrollY))) - before), "스크롤 위치 복원").toBeLessThanOrEqual(4);
      const after = await page.evaluate(() => window.__shifts);
      expect(
        after.reduce((a, e) => a + e.v, 0),
        `돌아온 뒤 흔들림: ${after.flatMap((e) => e.src).slice(0, 6).join(" | ")}`,
      ).toBe(0);
    });
  });
