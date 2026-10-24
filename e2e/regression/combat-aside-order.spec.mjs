// 회귀(v0.3.2 친구 시험 피드백 ②, 사용자 10-25): 캐릭터 전투 탭 오른쪽 열(요약)은 순위 → 특성 → 각인 →
// 아크 패시브 → 조회수 순서(순위는 운영에서처럼 맨 위, 그 아래는 공식과 같은 특성 → 각인 먼저).
// 좁은 폭은 한 열에서 같은 순서. 순위는 첫 HTML에 담겨 와 처음부터 채워져 있고, 아무것도 움직이지 않는다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const ORDER = ["순위", "특성", "각인", "아크 패시브", "조회수"];

for (const width of [320, 360, 390, 1280])
  test(`@전투탭순서 ${width}: 요약 열 제목 순서, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    const aside = page.getByRole("complementary", { name: "요약", exact: true });
    await expect(aside.locator(":scope > * h2")).toHaveText(ORDER);
    // The rank block on top is filled (or says why not) from the first paint.
    await expect(aside.locator(":scope > *").first()).not.toContainText("불러오고 있어요");
    await page.waitForTimeout(600);
    const loaded = await shiftsSince(page);
    expect(loaded.all, `첫 로드 흔들림 (${loaded.moved})`).toBe(0);
  });

// The rank answering after the page's 1s wait (목 '순위늦음' 1.5s): the top block
// keeps the boxes' room while it loads, so the panels under it stay put.
for (const width of [320, 360, 390, 1280])
  test(`@전투탭순서 ${width}: 순위가 늦게 와도 아래 패널이 움직이지 않음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await page.goto(characterPath("순위늦음"));
    const aside = page.getByRole("complementary", { name: "요약", exact: true });
    const rank = aside.locator(":scope > *").first();
    await expect(rank.getByRole("status")).toHaveText("순위를 불러오고 있어요…");
    const before = await aside.locator(":scope > *").nth(1).boundingBox();
    await expect(rank.getByRole("region", { name: "전투력 순위" })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(600);
    expect(Math.round((await aside.locator(":scope > *").nth(1).boundingBox()).y), "특성 패널 제자리").toBe(Math.round(before.y));
    const loaded = await shiftsSince(page);
    expect(loaded.all, `순위가 채워질 때 흔들림 (${loaded.moved})`).toBe(0);
  });
