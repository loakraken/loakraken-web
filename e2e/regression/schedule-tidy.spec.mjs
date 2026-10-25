// 회귀(#1096): 일정 화면 정리.
// - 주간 날짜 줄은 8일이어도 한 줄(320에서도), 숫자 잘림 0, 가로 넘침 0. 휴대폰에서 날짜를 누르면 보이는 그 날이 골라진다.
// - 섬 카드 '자세히'(+N)는 다 못 보인 보상이 있을 때만. 보상이 셋 이하이면 단추가 없다.
// - 같은 시간대 안에서는 입장 레벨이 높은 것부터.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

/** The official week runs Wednesday to the next Wednesday (8 days); the mock answers 7. */
async function eightDayWeek(page) {
  await page.route("**/api/home/schedule?date=*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const data = (body.envelope ?? body).data;
    if (data?.coveredTo) {
      const next = new Date(Date.parse(`${data.coveredTo}T00:00:00Z`) + 86_400_000);
      data.coveredTo = next.toISOString().slice(0, 10);
    }
    await route.fulfill({ response, json: body });
  });
}

for (const width of [320, 360, 390, 1280])
  test(`일정 ${width}: 8일 날짜 줄이 한 줄, 누르면 보이는 그 날 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await eightDayWeek(page);
    await gotoReady(page, "/schedule");
    const days = page.getByRole("group", { name: "요일 선택" }).getByRole("button");
    // Today comes with the page (7 days in the mock); another day's answer has the 8-day week.
    await days.nth(1).click();
    await expect(days).toHaveCount(8);
    await expect(days.nth(1)).toHaveAttribute("aria-pressed", "true");
    const boxes = await days.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const b = el.querySelector("b");
        return { top: Math.round(r.top), left: r.left, right: r.right, cy: r.top + r.height / 2, cut: b.scrollWidth > b.clientWidth };
      }),
    );
    expect(new Set(boxes.map((b) => b.top)).size, "날짜 줄 한 줄").toBe(1);
    expect(boxes.filter((b) => b.cut), "날짜 숫자 잘림").toEqual([]);
    // A press anywhere on a day (its edges too) lands on that day, never the neighbour.
    const hits = await days.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const cy = r.top + r.height / 2;
        return [r.left + 1, r.right - 1].every((x) => document.elementFromPoint(x, cy)?.closest("button") === el);
      }),
    );
    expect(hits, "날짜 가장자리를 누르면 그 날").toEqual(Array(8).fill(true));
    await expectNoHorizontalOverflow(page);
  });

test("일정: 섬 자세히는 다 못 보인 보상이 있을 때만, 같은 시간대는 레벨 높은 순 @regression", async ({ page }) => {
  await gotoReady(page, "/schedule");
  const islands = page.getByRole("region", { name: "모험 섬", exact: true });
  const rows = islands.getByRole("listitem").filter({ has: page.locator("strong") });
  // Same rounds for all three in the mock: 볼라르 1,100 → 라일라이 635 → 메데이아 250.
  await expect(rows.locator("strong")).toHaveText(["볼라르 섬", "라일라이 아일랜드", "메데이아"]);
  // 메데이아 has five rewards: three shown, '+2' opens the rest.
  await expect(islands.getByRole("button", { name: "메데이아 보상 2개 더 보기" })).toHaveText("+2");
  // 볼라르 has none: no reward list and no button.
  await expect(islands.getByRole("button", { name: /^볼라르 섬 보상/ })).toHaveCount(0);
  // A field boss with two rewards shows them all: no 자세히 either (the mock's boss days are odd dates).
  const boss = page.getByRole("region", { name: "필드 보스", exact: true });
  if (await boss.count()) await expect(boss.getByRole("button", { name: /보상/ })).toHaveCount(0);
});
