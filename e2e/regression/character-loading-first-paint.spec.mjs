// 회귀(A7, equipment-grade-background.spec.mjs:48 @320 light, CI: routeState의 p·canvas가 깨기 전 35px 위로):
// 캐릭터 화면이 오기 전의 '조회 중' 화면은 내용을 세로 가운데에 둔다. 첫 HTML이 나뉘어 와 아래 줄(검색으로 돌아가기)이
// 늦게 오면 내용 높이가 70px(링크 47 + 간격 22) 늘어 위의 구슬·문구가 35px 올라갔다. 이제 세 줄의 높이가 처음부터 잡혀
// 있어, 어디서 끊겨 와도 움직이지 않는다.
import { test, expect } from "../support/fixtures.mjs";

for (const width of [320, 1280])
  test(`@A7 ${width} 캐릭터 조회 중 화면: 아래 줄이 늦게 와도 구슬·문구가 움직이지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    // '로딩' answers 1.5 s late (tests/mock-backend.mjs), so the loading screen stays up long enough to cut.
    await page.goto(`/character/${encodeURIComponent("로딩")}`, { waitUntil: "commit" });
    const status = page.getByRole("status").filter({ hasText: "캐릭터 정보를 조회하고 있어요." });
    await expect(status).toBeVisible();
    // Cut after each part of the screen in page order (the orb, the line, the links), append the rest back: what moved.
    const cut = await status.evaluate(async (line) => {
      const main = line.closest("main");
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const parts = [...main.children].filter((el) => el.tagName !== "NOSCRIPT");
      const moved = [];
      let value = 0;
      for (let i = 0; i < parts.length; i += 1) {
        const later = parts.slice(i + 1);
        if (!later.length) break;
        for (const el of later) el.remove();
        await frame();
        const entries = [];
        const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
        observer.observe({ type: "layout-shift" });
        main.append(...later);
        await frame();
        await frame();
        entries.push(...observer.takeRecords());
        observer.disconnect();
        const v = entries.reduce((sum, e) => sum + e.value, 0);
        if (v > 0) {
          value += v;
          const r = (b) => `${Math.round(b.y)} ${Math.round(b.height)}`;
          moved.push(`${parts[i].tagName.toLowerCase()} 뒤 → ` + entries.flatMap((e) => e.sources.map((s) => `${s.node?.nodeName ?? "?"} ${r(s.previousRect)}→${r(s.currentRect)}`)).join(" | "));
        }
      }
      return { parts: parts.length, value: +value.toFixed(6), moved };
    });
    expect(cut.parts, "조회 중 화면의 줄").toBe(3);
    expect(cut.value, `움직인 것: ${cut.moved.join(" / ")}`).toBe(0);
  });
