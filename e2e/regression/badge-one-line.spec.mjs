// 회귀(사용자 지적 회귀 점검표 A31): 배지·칩·단위는 줄바꿈하지 않는다. 이름이 길면 이름 글자만
// 줄바꿈하고 배지는 한 덩어리로 남는다(시세 '상급 아비도스 융화 재료'의 T4가 'T / 4'로 쪼개졌던 지적).
// 좁은 화면(360)에서 화면마다 배지류 요소의 글자가 한 줄 상자에 들어가는지 잰다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test.use({ viewport: { width: 360, height: 800 } });

const BADGES = [
  "[class*=rowName] strong i",
  "[class*=unit]",
  "[class*=betaChip]",
  "[class*=skillChips] > li",
  "[class*=tier]",
  "[class*=Tag]",
  "[class*=tag]",
  "[class*=badge]",
  "[class*=Badge]",
  "[class*=chip]",
].join(",");

/** Badge-like leaves whose text runs over more than one line box. */
const splitBadges = (page) =>
  page.evaluate((selector) => {
    const out = [];
    for (const el of document.querySelectorAll(`main :is(${selector})`)) {
      // Containers of several chips (e.g. a tier button group) may wrap; only leaves count.
      if ([...el.children].some((c) => c.tagName !== "svg" && c.tagName !== "SVG" && getComputedStyle(c).display !== "inline")) continue;
      const text = el.textContent.trim();
      if (!text || text.length > 16 || !el.getClientRects().length) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
      if (tops.size > 1) out.push(text);
    }
    return out;
  }, BADGES);

for (const [name, path] of [
  ["시세", "/market"],
  ["랭킹", "/rankings"],
  ["통계", "/stats"],
  ["캐릭터 전투", characterPath("상세")],
  ["캐릭터 스킬", characterPath("상세", "skills")],
  ["치적 도구", "/tools/crit-speed"],
  ["레이드 보상표", "/tools/raid-rewards"],
]) {
  test(`${name}: 배지·칩·단위가 한 줄 @regression`, async ({ page }) => {
    await gotoReady(page, path);
    await page.waitForTimeout(500);
    expect(await splitBadges(page), "두 줄로 쪼개진 배지").toEqual([]);
  });
}

test("시세: 긴 이름 줄의 T4 배지 높이가 짧은 이름 줄과 같다 @regression", async ({ page }) => {
  await gotoReady(page, "/market");
  const badges = page.locator("[class*=rowName] strong i");
  await expect(badges.first()).toBeVisible();
  const heights = await badges.evaluateAll((els) => [...new Set(els.map((el) => Math.round(el.getBoundingClientRect().height)))]);
  expect(heights).toHaveLength(1);
});
