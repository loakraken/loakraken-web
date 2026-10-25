// 회귀(develop e2e 10-25 저녁): /schedule '다가오는 일정' 카드에서 남은 시간이 좁은 칸(320 약 116px)에
// 시각 옆으로 끼어 두 줄로 접혔다('1시간 / 56분'). 글자 길이가 바뀔 때(시간 → 분) 접힘이 생기고 없어져
// 카드 높이가 바뀌고 아래가 움직였다(시각에 따라 첫 로드 흔들림 0.0001). 남은 시간은 늘 한 줄, 카드 높이는 같다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

for (const width of [320, 360, 390])
  test(`다가오는 일정 남은 시간은 한 줄, 카드 높이 같음 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/schedule");
    const section = page.getByRole("region", { name: "다가오는 일정" });
    // Late at night today's rounds can all be over (no cards): nothing to check then.
    const cards = section.getByRole("listitem");
    test.skip((await cards.count()) === 0, "no rounds left today");
    const rows = await cards.evaluateAll((items) =>
      items.map((li) => {
        const time = li.querySelector("[class*=roundTime]");
        const countdown = time.querySelector("b");
        const line = parseFloat(getComputedStyle(countdown).lineHeight) || 18;
        return {
          text: countdown.textContent,
          lines: Math.round(countdown.getBoundingClientRect().height / line),
          height: Math.round(time.getBoundingClientRect().height),
        };
      }),
    );
    for (const row of rows) expect(row.lines, row.text).toBe(1);
    expect(new Set(rows.map((row) => row.height)).size, JSON.stringify(rows)).toBe(1);
  });
