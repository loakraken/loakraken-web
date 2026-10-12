// 시세판 바뀐 칸 강조(K34): 1분 갱신에서 값이 바뀐 칸만 강조(▲/▼, 한 번 흐려짐)하고,
// 숫자는 바로 최종값이다. 강조가 나타나도 가격 위치는 그대로다(CLS 0).
import { test, expect } from "../support/fixtures.mjs";

test.describe("시세판 바뀐 칸 강조 @smoke", () => {
  test("1분 갱신에서 바뀐 가격만 강조하고 자리는 그대로다", async ({ page }) => {
    await page.clock.install();
    await page.route("**/api/markets/board?*", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const tab = new URL(route.request().url()).searchParams.get("tab");
      // 첫 화면은 서버가 그려 보내므로 브라우저 요청은 모두 1분 갱신이다
      if (tab === "ENGRAVING_BOOK" && body.ok) {
        const first = body.envelope.data.items[0];
        first.currentMinPrice += 10;
        first.changeDay = (first.changeDay ?? 0) + 5;
      }
      await route.fulfill({ response, json: body });
    });
    // 가짜 시계에서는 networkidle을 기다리지 않는다. 1분 갱신 타이머는
    // 하이드레이션 뒤에 걸리므로, 갱신 상태 표시가 뜬 뒤에 시간을 보낸다.
    await page.goto("/market?tab=ENGRAVING_BOOK");
    await page.waitForLoadState("load");
    const board = page.getByRole("region", { name: /각인서 시세/ });
    const rows = board.getByRole("listitem");
    await expect(rows).toHaveCount(10);
    const firstPrice = rows.first().locator('[data-slot="change-mark"]').first();
    const before = await firstPrice.boundingBox();
    // 가격·등락 묶음: 등락 자릿수가 늘어도 폭이 그대로라 왼쪽 끝도 그대로다(A7).
    // 가격 칸은 묶음 폭을 다 쓰고 글자만 오른쪽에 붙어, 숫자 폭이 달라도(글꼴마다
    // 20G·30G 폭이 다름) 칸 상자는 그대로다.
    const group = firstPrice.locator("xpath=..");
    const groupBefore = await group.boundingBox();
    await expect(board.locator('[data-slot="change-mark"][data-tone]')).toHaveCount(0);

    await page.clock.fastForward(61_000);
    await expect(firstPrice).toHaveAttribute("data-tone", "up");
    // 바뀐 것은 첫 품목의 가격·등락 두 칸뿐이다
    await expect(board.locator('[data-slot="change-mark"][data-tone]')).toHaveCount(2);
    await expect(firstPrice.getByText("▲")).toBeAttached();
    // 등락 칸은 자기 ▲/▼가 있어 강조 화살표 없이 바탕만 바뀐다
    await expect(rows.first().locator('[data-slot="change-mark"]').nth(1)).toHaveAttribute("data-tone", "same");
    const after = await firstPrice.boundingBox();
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(await group.boundingBox()).toEqual(groupBefore);
    await page.clock.fastForward(2_000);
    await expect(page.getByRole("status").filter({ hasText: "시세 1개 바뀜." })).toBeAttached();
    await expect(board.locator('[data-slot="change-mark"][data-tone]')).toHaveCount(0);
  });
});
