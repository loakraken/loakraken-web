// 회귀(P1 flaky, #1649 CI header-late-part:46 @1280 /market): 시세 추이의 기간 줄은 첫 HTML이 줄의 시작 태그 뒤에서 끊겨
// 오면 단추 없이 92px(안쪽 여백만)로 그려졌다가 단추가 오며 230px로 넓어졌다. 줄은 오른쪽 끝에 있어, 넓어지며 왼쪽으로
// 자랐다. 단추 폭은 정해져 있었지만(#1613) 줄 자체의 폭이 단추를 기다렸다. 이제 줄의 폭도 글자 수로 정해져, 어디서
// 끊겨 와도(단추 하나 없이도) 줄과 이미 그려진 것이 움직이지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

for (const width of [1280, 360, 320])
  test(`@A7 ${width} /market: 시세 추이 머리(기간 줄 포함)가 어디서 끊겨 와도 움직이지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/market");
    await expect(page.getByRole("group", { name: "기간" }).getByRole("button")).toHaveCount(5);
    // Every start tag and text node of the chart's head (title, period change, the period row and its buttons),
    // cut and put back in page order.
    const cut = await cutEverywhere(page, '[class*="trendHead"]|시세 추이');
    expect(cut.probed, "잘라 본 곳").toBeGreaterThan(5);
    expect(cut.value, `움직인 것: ${cut.moved.join(" / ")}`).toBe(0);
  });
