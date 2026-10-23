// 회귀(v0.3.2 친구 시험 피드백 ③): 원정대 탭은 캐릭터 목록이 맨 위(정렬·축약 도구 바로 아래)이고,
// 식스맨 요약·전투력·아이템 레벨·구성·주간 골드·원정대 갱신 시각은 목록 아래다. 첫 HTML부터 그 순서라
// 흔들림 0, 360에서도 탭 안의 첫 블록이 목록이다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

for (const [width, height] of [
  [1280, 900],
  [360, 800],
])
  test(`@원정대목록 ${width}: 캐릭터 목록이 탭 안 첫 블록(요약·주간 골드보다 위), 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shifts.push(e.value);
      }).observe({ type: "layout-shift", buffered: true });
    });
    // The first HTML already has the list on top.
    const html = await (await page.request.get(characterPath("상세", "siblings"))).text();
    const listAt = html.indexOf("siblingGrid");
    expect(listAt, "첫 HTML에 목록").toBeGreaterThan(0);
    // First appearances (the page's own markup comes before its data scripts).
    for (const later of ["식스맨 평균", "주간 획득 골드"])
      expect(html.indexOf(later), `첫 HTML에서 '${later}'는 목록 뒤`).toBeGreaterThan(listAt);

    await gotoReady(page, characterPath("상세", "siblings"));
    const first = page.locator("ul[class*=siblingGrid] li").first();
    await expect(first).toBeVisible();
    // The first block in the tab: only the server's heading between the tools
    // and the first card (at 360 the banner above is the shared part, v0.3.2 (b)).
    const box = await first.boundingBox();
    const tools = await page.locator("[class*=rosterTools]").boundingBox();
    test.info().annotations.push({ type: "첫 카드 시작", description: `${Math.round(box.y)}px (도구 아래 ${Math.round(tools.y + tools.height)}px)` });
    expect(box.y - (tools.y + tools.height), "도구와 첫 카드 사이(서버 제목만)").toBeLessThanOrEqual(72);
    // In the page too: the first list comes before the summary line.
    const order = await page.evaluate(() => {
      const list = document.querySelector("ul[class*=siblingGrid]");
      const six = [...document.querySelectorAll("p")].find((p) => p.textContent?.startsWith("식스맨 평균"));
      return list && six ? list.compareDocumentPosition(six) & Node.DOCUMENT_POSITION_FOLLOWING : -1;
    });
    expect(order, "식스맨 요약이 목록 뒤").toBeGreaterThan(0);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.__shifts.reduce((a, v) => a + v, 0)), "첫 로드 흔들림").toBe(0);
  });
