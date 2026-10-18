// 회귀(v0.3.2, api #624): 시세판 품목 이름 검색. 초성(ㅇㅂㄷ)·이름 일부로 지금 탭을 서버에서 거르고, 입력이
// 300ms 쉬면 한 번만 묻고, 주소에 ?q=가 남고 탭을 바꿔도 유지된다. 결과가 와도 아무것도 움직이지 않는다.
// 탭에 없으면 '재료 전체에서 찾기'를 눌렀을 때만 거래소 품목 검색을 한 번 부른다(같은 이름은 캐시).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const watch = (page) =>
  page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (!e.hadRecentInput)
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
const quietShift = async (page) => {
  const all = await page.evaluate(() => window.__shifts);
  return { sum: all.reduce((a, e) => a + e.v, 0), moved: all.flatMap((e) => e.src).slice(0, 4).join(" | ") };
};
const boardAsks = (page) => {
  const asked = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname === "/api/markets/board") asked.push(url.searchParams.get("q"));
  });
  return asked;
};

for (const width of [1280, 360])
  test(`@시세검색 ${width}: 초성·이름 일부, 300ms 한 번, 주소 유지, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watch(page);
    const asked = boardAsks(page);
    await gotoReady(page, "/market");
    const field = page.getByRole("searchbox", { name: "품목 이름" });
    await expect(field).toBeVisible();
    const height = (await field.locator("..").boundingBox()).height;
    await page.evaluate(() => (window.__shifts = []));

    // Initials: 아비도스 융화 재료 (ㅇㅂㄷㅅ), not 운명의 파괴석.
    await field.pressSequentially("ㅇㅂㄷ", { delay: 60 });
    await expect(page).toHaveURL(/[?&]q=%E3%85%87%E3%85%82%E3%84%B7(&|$)/);
    const rows = page.locator("section", { has: page.locator("#board-heading") }).locator("ul li button strong");
    await expect(rows.first()).toContainText("아비도스");
    await expect(page.locator("main").getByText("운명의 파괴석", { exact: true })).toHaveCount(0);
    // One question for the whole word (typing rested once).
    expect(asked.filter((q) => q !== null), "입력 중 요청").toEqual(["ㅇㅂㄷ"]);
    await page.waitForTimeout(600);
    const typed = await quietShift(page);
    expect(typed.sum, `검색 결과가 온 뒤 흔들림 (${typed.moved})`).toBe(0);
    expect((await field.locator("..").boundingBox()).height, "검색칸 높이").toBe(height);

    // Part of a name; kept when the tab changes.
    await page.getByRole("button", { name: "검색어 지우기" }).click();
    await expect(page).not.toHaveURL(/[?&]q=/);
    await field.pressSequentially("파괴석", { delay: 60 });
    await expect(page).toHaveURL(/[?&]q=%ED%8C%8C%EA%B4%B4%EC%84%9D/);
    await expect(rows.first()).toContainText("파괴석");
    await page.getByRole("tab").nth(1).click();
    await expect(page).toHaveURL(/[?&]q=%ED%8C%8C%EA%B4%B4%EC%84%9D/);
    await expect(field).toHaveValue("파괴석");
  });

test("@시세검색 탭에 없으면 '재료 전체에서 찾기'를 눌렀을 때만 한 번, 결과를 누르면 상세 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  const items = [];
  page.on("request", (r) => new URL(r.url()).pathname === "/api/markets/items" && items.push(new URL(r.url()).searchParams.get("itemName")));
  await gotoReady(page, "/market?q=%ED%95%A9%EC%84%B1%20%ED%8C%8C%ED%8E%B8");
  await expect(page.getByText("‘합성 파편’에 맞는 품목이 이 분류에 없어요.")).toBeVisible();
  const wider = page.getByRole("button", { name: "재료 전체에서 찾기" });
  await expect(wider).toBeVisible();
  // The whole label shows (A37), and nothing was asked before the press.
  expect(await wider.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(items).toEqual([]);
  await wider.click();
  const found = page.getByRole("list", { name: "재료 전체에서 찾은 품목" });
  await expect(found.getByRole("button", { name: /합성 파편 주머니/ })).toBeVisible();
  await expect(page.getByText("다른 분류의 품목은 그 탭에서 찾아 주세요.")).toBeVisible();
  expect(items).toEqual(["합성 파편"]);
  await found.getByRole("button", { name: /합성 파편 주머니/ }).click();
  await expect(page).toHaveURL(/[?&]item=103(&|$)/);
  await expect(page.getByRole("heading", { name: /합성 파편 주머니/ }).first()).toBeVisible();
});

test("@시세검색 품목 검색이 칸에 걸리면 안내 문구 @regression", async ({ page }) => {
  await page.route("**/api/markets/items?*", (route) =>
    route.fulfill({
      status: 429,
      headers: { "Retry-After": "30" },
      json: { ok: false, error: { code: "LOST_ARK_RATE_LIMITED", status: 429, retryAt: Date.now() + 30_000, limit: "client" } },
    }),
  );
  await gotoReady(page, "/market?q=%ED%95%A9%EC%84%B1%20%ED%8C%8C%ED%8E%B8");
  await page.getByRole("button", { name: "재료 전체에서 찾기" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "짧은 시간에 검색이 많아 잠깐 쉬어 가요" })).toBeVisible();
});
