// 회귀(M49 2단계, web #1969): 전투력 시뮬레이터의 젬 가공 순위(GEM_RANKING, e2e 켬). 목은 api CI 표본(28줄, 혼돈의 해 코어 젬
// 0~3)을 돌려준다. 단추를 눌러야 계산하고, 젬마다 가장 좋은 방법 한 줄 + 다른 방법은 접힘. 페온 1개 골드를 넣으면 비용 ·
// 1%당 골드가, 초기화권 가격을 넣으면 초기화 줄이 생긴다(기본값 없음: 넣지 않으면 요청에 가격이 없다). 429는 다시 시도
// 시간과 함께 알린다. 320에서 가로 넘침 없음.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const path = `/tools/combat-power?character=${encodeURIComponent("전투력젬바꿈")}`;
const ROUTE = "/api/combat-power/gem-ranking";
const card = (page) => page.getByRole("region", { name: "젬 가공 순위" });
const groups = (page) => card(page).getByRole("list", { name: "젬마다 가장 좋은 가공 방법" }).locator(":scope > li");

for (const width of [320, 1280])
  test(`${width}: 누르면 젬마다 가장 좋은 방법, 가격을 넣으면 비용 · 초기화 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const asked = [];
    page.on("request", (r) => new URL(r.url()).pathname === ROUTE && asked.push(r.postDataJSON()));
    await page.goto(path);
    await expect(card(page)).toBeVisible();
    await page.waitForTimeout(300);
    expect(asked, "누르기 전 요청 없음").toEqual([]);

    // No price typed: none sent (no default), costs wait with what they need.
    await card(page).getByRole("button", { name: "순위 계산" }).click();
    await expect(groups(page)).toHaveCount(4);
    expect(asked[0]).toEqual({ characterName: "전투력젬바꿈", grade: "HERO", limit: 200 });
    const first = groups(page).first();
    await expect(first).toContainText("현란한 공격 젬 2");
    await expect(first).toContainText("침식 젬으로 · 효과 상관없이 · 포인트 합 16 이상");
    await expect(first).toContainText("19.9%");
    await expect(first).toContainText("비용 계산에 필요한 값: 페온 1개 골드");
    await expect(first.locator("details summary")).toHaveText("다른 방법 7개");

    // 페온 and 초기화권 typed: both sent; costs and 1%당 골드 appear, 초기화 rows join.
    await card(page).getByRole("textbox", { name: "페온 1개 골드" }).fill("72.5");
    await card(page).getByRole("textbox", { name: "초기화권 가격(골드)" }).fill("59,110");
    await card(page).getByRole("button", { name: "순위 계산" }).click();
    await expect.poll(() => asked.at(-1)?.prices).toEqual({ resetTicketGold: 59110, pheonGold: 72.5 });
    await expect(groups(page).first()).toContainText(/기대 비용\s*[\d,]+G/);
    await expect(groups(page).first()).toContainText(/1%당 골드\s*[\d,]+G/);
    await expect(card(page)).toContainText("초기화 사용");
    await expectNoHorizontalOverflow(page);
  });

test("가격 칸이 맞지 않으면(페온 소수 셋째 자리) 안내하고 단추를 막는다 @regression", async ({ page }) => {
  await page.goto(path);
  await card(page).getByRole("textbox", { name: "페온 1개 골드" }).fill("1.234");
  await expect(card(page).getByRole("status")).toContainText("소수 둘째 자리까지");
  await expect(card(page).getByRole("button", { name: "순위 계산" })).toHaveAttribute("aria-disabled", "true");
});

test("자리가 다 차면(429) 알리고 다시 시도 시간을 보인다 @regression", async ({ page }) => {
  await page.route(
    (url) => url.pathname === ROUTE,
    (route) =>
      route.fulfill({
        status: 429,
        headers: { "Retry-After": "3" },
        json: { ok: false, error: { code: "GEM_RANKING_BUSY", status: 429, retryAt: Date.now() + 3000 } },
      }),
  );
  await page.goto(path);
  await card(page).getByRole("button", { name: "순위 계산" }).click();
  await expect(card(page).getByRole("alert")).toContainText("지금은 계산하는 사람이 많아요");
  await expect(card(page).getByRole("button", { name: /순위 계산/ })).toHaveAttribute("aria-disabled", "true");
});

// web #1971: the answer lands well after the press (a heavy solve). Held here, then released: the card keeps its
// place and size before the press, while waiting and after the answer, so nothing below it moves (A7).
for (const width of [320, 1280])
  test(`${width}: 답을 기다리는 동안과 답 뒤에도 카드 크기가 같다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === ROUTE,
      async (route) => {
        await held;
        await route.continue();
      },
    );
    await page.goto(path);
    await expect(card(page)).toBeVisible();
    const measure = () =>
      card(page).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top + window.scrollY), height: Math.round(r.height) };
      });
    const before = await measure();
    await card(page).getByRole("button", { name: "순위 계산" }).click();
    await expect(card(page).getByRole("button", { name: "계산하는 중…" })).toBeVisible();
    expect(await measure(), "기다리는 동안").toEqual(before);
    release();
    await expect(groups(page)).toHaveCount(4);
    expect(await measure(), "답 뒤").toEqual(before);
    await expectNoHorizontalOverflow(page);
  });