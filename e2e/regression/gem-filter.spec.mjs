// 회귀(api #542, 오픈 전 사용자 결정): 보석 매물을 직업 → 스킬로 좁힌다. 표의 최저가는 그대로(모든 보석),
// 스킬은 고른 칸의 종류(겁화/작열)에 쓸 수 있는 것만, 주소에 직업·스킬이 남아 공유된다. 칸을 바꾸면 직업은
// 남고 그 종류에 안 되는 스킬은 빠진다. 고르는 동안 흔들림 0, 틀린 조건·검색 몫 초과는 안내.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const board = (page) => page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" });
const filter = (page) => page.getByRole("form", { name: "매물 직업·스킬" });
const shiftLog = (page) =>
  page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        window.__shifts.push({
          v: e.value,
          src: (e.sources ?? []).map((s) => {
            const el = s.node?.nodeType === 1 ? s.node : s.node?.parentElement;
            const r = (b) => [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 10) / 10).join(",");
            return `${el?.tagName}"${(el?.textContent ?? "").slice(0, 14)}" @${Math.round(e.startTime)} ${r(s.previousRect)}→${r(s.currentRect)}`;
          }),
        });
    }).observe({ type: "layout-shift", buffered: true });
  });
const shifts = (page) => page.evaluate(() => window.__shifts.reduce((a, e) => a + e.v, 0));
const moved = (page) => page.evaluate(() => [...new Set(window.__shifts.flatMap((e) => e.src))].slice(0, 6).join(" | "));

async function pickOption(page, label, option) {
  await filter(page).getByLabel(label).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

for (const width of [1280, 360])
  test(`@보석필터 ${width} 직업 → 스킬로 매물만 좁히고 주소에 남김, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await shiftLog(page);
    await gotoReady(page, "/market/gems");
    // Before a cell: the row is there, waiting.
    await expect(filter(page)).toContainText("위 표에서 칸을 고르면 직업·스킬로 거를 수 있어요.");
    await expect(filter(page).getByLabel("직업")).toBeDisabled();
    const section = page.getByRole("region", { name: /매물/ }).last();
    const height = async () => Math.round((await page.locator("section[aria-labelledby=gem-listings-heading]").boundingBox()).height);
    const before = await height();

    await board(page).getByRole("button", { name: "10레벨 겁화의 보석 매물 보기" }).click();
    await expect(page.getByRole("heading", { name: /10레벨 겁화의 보석 매물/ })).toBeVisible();
    await expect(filter(page)).toContainText("직업·스킬은 아래 매물만 걸러요. 표의 최저가는 모든 보석 기준이에요.");
    await expect(filter(page).getByLabel("스킬")).toBeDisabled();

    await pickOption(page, "직업", "바드");
    await expect(page).toHaveURL(/class=%EB%B0%94%EB%93%9C/);
    await expect(page).not.toHaveURL(/skill=/);
    // 바드 is a supporter: some of its skills are not offered yet, and the note says so.
    await expect(filter(page)).toContainText("일부 서포터 스킬은 아직 고를 수 없어요.");
    await expect(page.locator("section[aria-labelledby=gem-listings-heading] tbody tr:not([aria-hidden])")).toHaveCount(2);
    // 겁화: only the skill that works on 겁화 is offered.
    await filter(page).getByLabel("스킬").click();
    await expect(page.getByRole("option")).toHaveText(["모든 스킬", "사운드 쇼크"]);
    await page.getByRole("option", { name: "사운드 쇼크" }).click();
    await expect(page).toHaveURL(/skill=21170/);
    await expect(page.locator("section[aria-labelledby=gem-listings-heading] tbody th").first()).toHaveText("바드 · 사운드 쇼크");

    // Another cell keeps the class and a skill that works there…
    await board(page).getByRole("button", { name: /^9레벨 작열의 보석 매물 보기/ }).click();
    await expect(page).toHaveURL(/kind=%EC%9E%91%EC%97%B4.*class=.*skill=21170/);
    await pickOption(page, "스킬", "윈드 오브 뮤직");
    await expect(page).toHaveURL(/skill=21140/);
    // …and drops one that does not (윈드 오브 뮤직 is 작열 only).
    await board(page).getByRole("button", { name: "10레벨 겁화의 보석 매물 보기" }).click();
    await expect(page).toHaveURL(/class=/);
    await expect(page).not.toHaveURL(/skill=/);
    await expect(filter(page).getByLabel("스킬")).toHaveText("모든 스킬");

    // The board prices are not filtered; nothing moved; the box kept its height.
    await expect(board(page).getByRole("button", { name: /매물 보기/ })).toHaveCount(19);
    expect(await height(), "매물 칸 높이 그대로").toBe(before);
    expect(await shifts(page), `흔들림: ${await moved(page)}`).toBe(0);
    await expect(section).toBeVisible();
  });

test("@보석필터 공유 주소의 직업·스킬이 그대로 열리고, 그 칸에 안 되는 조건은 안내 @regression", async ({ page }) => {
  await gotoReady(page, "/market/gems?kind=%EC%9E%91%EC%97%B4&level=9&class=%EB%B0%94%EB%93%9C&skill=21140");
  await expect(filter(page).getByLabel("직업")).toHaveText("바드");
  await expect(filter(page).getByLabel("스킬")).toHaveText("윈드 오브 뮤직");
  await expect(page.locator("section[aria-labelledby=gem-listings-heading] tbody th").first()).toHaveText("바드 · 윈드 오브 뮤직");
  // 윈드 오브 뮤직 on a 겁화 cell (a hand-made link): the backend says no.
  await gotoReady(page, "/market/gems?kind=%EA%B2%81%ED%99%94&level=10&class=%EB%B0%94%EB%93%9C&skill=21140");
  await expect(page.getByText("이 직업·스킬로는 이 보석을 찾을 수 없어요. 조건을 바꿔 주세요.")).toBeVisible();
});

test("@보석필터 검색 몫을 넘기면(503 MARKET_SEARCH_BUSY) 남은 시간과 다시 시도 @regression", async ({ page }) => {
  await page.route(/\/api\/markets\/auctions\/gems\/listings\?.*class=/, (route) =>
    route.fulfill({
      status: 503,
      headers: { "Retry-After": "30" },
      json: { ok: false, error: { code: "MARKET_SEARCH_BUSY", status: 503, retryAt: Date.now() + 30_000 } },
    }),
  );
  await gotoReady(page, "/market/gems?kind=%EA%B2%81%ED%99%94&level=10");
  await pickOption(page, "직업", "블래스터");
  await expect(page.getByText(/초 뒤 다시 시도해 주세요\.$/)).toBeVisible();
  await expect(page.getByRole("button", { name: /초 뒤 다시 시도$/ })).toBeDisabled();
});

// v0.3.2 P2 (#894 후속): 백엔드 필터가 꺼졌는데(404 GEM_FILTER_DISABLED) 공유 주소에 직업이 남아 있으면
// 같은 칸을 조건 없이 다시 불러 매물을 보이고, 주소에서도 직업·스킬을 뗀다(다시 시도만 남는 막다른 길 없음).
test("@보석필터 필터가 꺼졌으면 공유 주소의 직업·스킬을 떼고 같은 칸 매물 @regression", async ({ page }) => {
  // Every listings request: the refused one with the class, then the same cell once without it.
  const asked = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname.endsWith("/gems/listings")) asked.push(url.searchParams.get("class") ?? "");
  });
  await gotoReady(page, "/market/gems?kind=%EA%B2%81%ED%99%94&level=10&class=%ED%95%84%ED%84%B0%EA%BA%BC%EC%A7%90&skill=21170");
  const listings = page.getByRole("region", { name: /^10레벨 겁화의 보석 매물/ });
  await expect(listings.getByRole("row").nth(1)).toBeVisible();
  await expect(page.getByText("매물을 불러오지 못했어요.")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(asked, "목록 요청(거절 1번 → 조건 없이 1번, 되풀이 없음)").toEqual(["필터꺼짐", ""]);
  await expect(page).toHaveURL(/kind=%EA%B2%81%ED%99%94&level=10$/);
  await expect(page).not.toHaveURL(/class=|skill=/);
});