// 회귀(메뉴 합치기, 사용자 승인 10-26): 비슷한 페이지를 탭이 있는 묶음 화면 4개로.
// 탭 하나 = 지금 페이지 하나(주소 그대로), 제목 아래 탭 줄, 서버에서 그린 링크.
// 재료 구매 견적만 /market/quote로 옮기고 예전 주소는 308(쿼리 유지).
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

// Tabs that are always on (flagged ones may be off on a deployment).
const HUBS = [
  { name: "시세", tabs: [["거래소", "/market"], ["보석", "/market/gems"], ["장신구", "/market/accessories"], ["재료 견적", "/market/quote"]] },
  { name: "레이드", tabs: [["보상표", "/tools/raid-rewards"], ["더보기 손익", "/tools/more-reward"], ["경매 입찰가", "/tools/auction"], ["기여도", "/tools/contribution"], ["컨닝페이퍼", "/tools/raid-cheatsheet"]] },
  { name: "골드 효율", tabs: [["로아샵", "/tools/loa-shop"], ["아비도스 제작", "/tools/abidos-craft"], ["생명의 기운", "/tools/life-energy"]] },
  { name: "캐릭터 성장", tabs: [["재련", "/tools/refining"]] },
];

const tabRow = (page, hub) => page.getByRole("navigation", { name: `${hub} 화면` });

test.describe("묶음 화면 탭 @regression", () => {
  for (const hub of HUBS)
    test(`${hub.name}: 탭마다 자기 주소에서 열리고 지금 탭이 표시되며, 탭 링크는 서버 HTML에 있다`, async ({ page }) => {
      for (const [label, path] of hub.tabs) {
        // Server-rendered: the links are in the HTML before any script runs.
        const html = await (await page.request.get(path)).text();
        expect(html, `${path}: 탭 줄`).toContain(`aria-label="${hub.name} 화면"`);
        for (const [, other] of hub.tabs) expect(html, `${path}: ${other} 링크`).toContain(`href="${other}"`);
        await page.goto(path);
        const row = tabRow(page, hub.name);
        await expect(row.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
        await expect(row.locator('[aria-current="page"]')).toHaveCount(1);
      }
    });

  test("탭을 누르거나 키보드로 고르면 그 페이지 주소로 간다", async ({ page }) => {
    await page.goto("/tools/raid-rewards");
    const row = tabRow(page, "레이드");
    await row.getByRole("link", { name: "더보기 손익", exact: true }).click();
    await expect(page).toHaveURL(/\/tools\/more-reward$/);
    await expect(tabRow(page, "레이드").getByRole("link", { name: "더보기 손익", exact: true })).toHaveAttribute("aria-current", "page");
    await tabRow(page, "레이드").getByRole("link", { name: "경매 입찰가", exact: true }).focus();
    await page.keyboard.press("Enter");
    // The tool may add its own default inputs to the query (?party=8).
    await expect(page).toHaveURL(/\/tools\/auction(\?|$)/);
  });

  test("예전 재료 구매 견적 주소는 쿼리를 지닌 채 /market/quote로 308, sitemap은 새 주소만", async ({ page }) => {
    const old = await page.request.get("/tools/material-quote?category=10100", { maxRedirects: 0 });
    expect(old.status()).toBe(308);
    expect(old.headers()["location"]).toMatch(/\/market\/quote\?category=10100$/);
    await page.goto("/tools/material-quote?category=10100");
    await expect(page).toHaveURL(/\/market\/quote\?category=10100$/);
    await expect(tabRow(page, "시세").getByRole("link", { name: "재료 견적", exact: true })).toHaveAttribute("aria-current", "page");
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/market/quote</loc>");
    expect(sitemap).not.toContain("/tools/material-quote");
  });

  test("상단 메뉴: 성장 도구의 묶음 제목은 그 묶음 화면으로 가고, 도구별 링크는 그대로 있다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/tools");
    await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("button", { name: "성장 도구" }).click();
    const panel = page.locator('[data-panel="tools"]');
    await expect(panel.getByRole("link", { name: "레이드", exact: true })).toHaveAttribute("href", "/tools/raid-rewards");
    await expect(panel.getByRole("link", { name: "골드 효율", exact: true })).toHaveAttribute("href", "/tools/loa-shop");
    await expect(panel.getByRole("link", { name: "캐릭터 성장", exact: true })).toHaveAttribute("href", "/tools/refining");
    await expect(panel.getByRole("link", { name: /더보기 손익/ })).toHaveAttribute("href", "/tools/more-reward");
    // 시세: 재료 구매 견적 links to its new address.
    await page.keyboard.press("Escape");
    await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("button", { name: "시세" }).click();
    await expect(page.locator('[data-panel="market"]').getByRole("link", { name: /재료 구매 견적/ })).toHaveAttribute("href", "/market/quote");
  });

  for (const width of [320, 360, 390, 1280])
    test(`${width}: 묶음 탭 줄이 잘리지 않고 페이지가 옆으로 넘치지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/market", "/tools/raid-rewards", "/tools/loa-shop", "/tools/refining"]) {
        await page.goto(path);
        const row = page.locator('nav[aria-label$=" 화면"]');
        await expect(row).toBeVisible();
        // Cut = clipped text: hit-44's larger tap area sticks out of each tab on
        // phones (scrollWidth) without hiding any of its label.
        const cut = await row.evaluate((nav) =>
          [...nav.querySelectorAll("a")]
            .filter((a) => {
              const text = document.createRange();
              text.selectNodeContents(a);
              const style = getComputedStyle(a);
              const room = a.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
              return text.getBoundingClientRect().width > room + 1;
            })
            .map((a) => a.textContent),
        );
        expect(cut, `${path}: 잘린 탭`).toEqual([]);
        await expectNoHorizontalOverflow(page);
      }
    });
});
