// 회귀(사용자 지적 10-16): 시세 차트 선 색은 차트 기간의 처음 대 끝인데 옆 숫자는 전일 대비라
// "오늘 하락인데 빨간 선"이 헷갈렸다. '시세 추이' 아래에 같은 기준의 기간 등락('14일 ▲3.2%',
// 분 차트는 '1시간 ▼0.4%')을 선과 같은 방향으로 보이고, ▲▼·문장으로 색만으로 뜻을 전하지 않는다.
// 전일 대비는 위 정보칸에 그대로. 기간을 바꿔도 흔들림 0, 360에서도 한 줄.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360])
  test(`@M ${width} 기간 등락이 선 색과 같은 방향, 기간마다 바뀌고 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market");
    const detail = page.getByRole("region", { name: "아비도스 융화 재료 시세" });
    await expect(detail.getByText("하루 평균 거래가와 거래량")).toBeVisible();
    const range = detail.getByRole("group", { name: "기간" });
    const read = () =>
      detail.evaluate((el) => {
        const label = el.querySelector("[class*=periodChange]");
        const chart = el.querySelector("svg[data-direction]");
        const shown = label?.querySelector("[aria-hidden=true]");
        const r = shown ? shown.getBoundingClientRect() : null;
        return {
          text: shown?.textContent?.trim() ?? "",
          said: label?.querySelector(".sr-only")?.textContent?.trim() ?? "",
          direction: label?.getAttribute("data-direction"),
          line: chart?.getAttribute("data-direction"),
          oneLine: r ? r.height < 24 : false,
        };
      });
    // Default 14 days, then 7 days, then the hour chart.
    for (const [button, period, chartName] of [
      [null, "14일", /^일 평균 거래가와 거래량/],
      ["7일", "7일", /^일 평균 거래가와 거래량/],
      ["1시간", "1시간", /^최근 1시간 판매 최저가/],
    ]) {
      if (button) {
        const moved = await shiftsDuring(page, () => range.getByRole("button", { name: button }).click(), 1500);
        expect(moved.all, `${button} 전환 흔들림 (${moved.moved})`).toBe(0);
      }
      await expect(detail.getByRole("img", { name: chartName })).toBeVisible();
      await expect.poll(async () => (await read()).text).toMatch(new RegExp(`^${period} [▲▼]?\\d+\\.\\d%$`));
      const now = await read();
      expect(now.direction, `${period}: 글자 방향 = 선 방향`).toBe(now.line);
      expect(now.said).toMatch(new RegExp(`^${period} 동안 \\d+\\.\\d% (올랐어요|내렸어요|그대로예요)$`));
      expect(now.text.includes("▲")).toBe(now.direction === "up");
      expect(now.text.includes("▼")).toBe(now.direction === "down");
      expect(now.oneLine, `${period}: 한 줄`).toBe(true);
    }
  });
