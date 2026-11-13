// 회귀(사용자 11-12): 보석 · 장신구는 따로 된 위 탭이 아니라 거래소 분류와 같은 한 줄(재련 재료 … + 보석 + 장신구)에
// 있다. 거래소 분류는 그 자리에서 바뀌고, 보석 · 장신구는 자기 주소로 간다. 보석 · 장신구 화면에서도 같은 줄이
// 보이고(그 분류가 고른 상태), 거래소 분류를 누르면 시세 화면이 그 분류로 열린다. 위 탭은 '품목 시세' 하나가
// 세 화면을 맡는다. 첫 그림 흔들림 0, 320에서 넘침 없음.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const row = (page) => page.getByRole("tablist", { name: "시세 분류" });
const hub = (page) => page.getByRole("navigation", { name: "시세 화면" });

for (const width of [320, 1280])
  test(`${width}: 보석 · 장신구가 시세 분류 줄 끝에 있고, 세 화면을 오간다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market");
    const names = await row(page).getByRole("tab").allTextContents();
    expect(names.slice(-2)).toEqual(["보석", "장신구"]);
    expect(names[0]).toBe("재련 재료");
    // One hub tab for the three pages; 보석 · 장신구 are no longer hub tabs.
    await expect(hub(page).getByRole("link", { name: "품목 시세", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(hub(page).getByRole("link", { name: "보석", exact: true })).toHaveCount(0);
    await expect(hub(page).getByRole("link", { name: "장신구", exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await row(page).getByRole("tab", { name: "보석", exact: true }).click();
    await expect(page).toHaveURL(/\/market\/gems(\?|$)/);
    await expect(page.getByRole("heading", { level: 1, name: "보석 시세" })).toBeVisible();
    await expect(row(page).getByRole("tab", { name: "보석", exact: true })).toHaveAttribute("aria-selected", "true");
    // The same row as on /market.
    expect(await row(page).getByRole("tab").allTextContents()).toEqual(names);
    await expect(hub(page).getByRole("link", { name: "품목 시세", exact: true })).toHaveAttribute("aria-current", "page");

    await row(page).getByRole("tab", { name: "각인서", exact: true }).click();
    await expect(page).toHaveURL(/\/market\?tab=ENGRAVING_BOOK/);
    await expect(row(page).getByRole("tab", { name: "각인서", exact: true })).toHaveAttribute("aria-selected", "true");

    await row(page).getByRole("tab", { name: "장신구", exact: true }).click();
    await expect(page).toHaveURL(/\/market\/accessories(\?|$)/);
    await expect(page.getByRole("heading", { level: 1, name: "장신구 시세" })).toBeVisible();
    await expect(row(page).getByRole("tab", { name: "장신구", exact: true })).toHaveAttribute("aria-selected", "true");
    await expectNoHorizontalOverflow(page);
  });

for (const path of ["/market/gems", "/market/accessories"])
  test(`320 ${path}: 분류 줄이 첫 HTML부터 같은 모습(흔들림 0) @regression`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await watchShifts(page);
    // The row is in the server HTML with the api's own list (prefetched), not a stand-in.
    const html = await (await page.request.get(path)).text();
    expect(html).toContain('aria-label="시세 분류"');
    await gotoReady(page, path);
    await expect(row(page).getByRole("tab", { name: "재련 재료", exact: true })).toBeEnabled();
    await page.waitForTimeout(500);
    const { all, moved } = await shiftsSince(page);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
