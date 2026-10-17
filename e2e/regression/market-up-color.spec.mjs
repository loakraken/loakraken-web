// 회귀(10-18 화면 확인): 시세 화면끼리 오름·내림 색이 같아야 한다. 시세판·차트는 오름 빨강(--market-up)인데
// 보석·장신구 시세판은 이득 색(--gain, 초록)을 써서 반대로 보였다. 보석·장신구 칸의 전일 대비도
// --market-up/--market-down을 쓴다(도구 화면의 이득·손해 색은 다른 뜻이라 그대로).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** The colour a token resolves to on this page, and the colours of the up/down marks in `scope`. */
const colours = (page, scope) =>
  page.evaluate((selector) => {
    const resolve = (token) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    const root = document.querySelector(selector);
    const of = (direction) => [...new Set([...root.querySelectorAll(`small[data-direction="${direction}"]`)].map((el) => getComputedStyle(el).color))];
    return { up: resolve("--market-up"), down: resolve("--market-down"), seenUp: of("up"), seenDown: of("down") };
  }, scope);

test("@시세색 보석 시세판의 전일 대비 오름·내림은 시세 색 @regression", async ({ page }) => {
  await gotoReady(page, "/market/gems");
  await expect(page.locator("table small[data-direction=up]").first()).toBeVisible();
  const c = await colours(page, "table");
  expect(c.seenUp, "오름 = --market-up").toEqual([c.up]);
  expect(c.seenDown, "내림 = --market-down").toEqual([c.down]);
});

test("@시세색 장신구 시세판의 전일 대비 오름·내림도 시세 색 @regression", async ({ page }) => {
  await gotoReady(page, "/market/accessories");
  const region = page.getByRole("region", { name: /^반지/ });
  await expect(region.locator("small[data-direction]").first()).toBeVisible();
  const c = await colours(page, "main");
  for (const seen of c.seenUp) expect(seen, "오름 = --market-up").toBe(c.up);
  for (const seen of c.seenDown) expect(seen, "내림 = --market-down").toBe(c.down);
  expect(c.seenUp.length + c.seenDown.length, "오름이나 내림 칸이 있음").toBeGreaterThan(0);
});
