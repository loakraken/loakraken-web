// 회귀(v0.3.2 P2): 320에서 재료 구매 견적 본문이 26px 가로로 넘쳤다(카드를 담는 grid 열이 자동 크기라
// 이름 입력칸의 기본 폭 300px만큼 카드가 넓어짐). 320·360·390·1280에서 가로 넘침 0, 카드는 화면 안
// (넓은 화면도 입력칸 폭 규칙이 바뀐 뒤 넘치지 않는지 함께 본다).
// 또 '가격 기준' 칸은 한 줄이 들어가지 않는 폭(320)에서 처음 HTML부터 세로라, 글꼴이 온 뒤 접히며
// 아래를 미는 일이 없다(첫 로드 흔들림 0, 측정 0.1216에서 발견).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [320, 360, 390, 1280])
  test(`@견적좁은폭 ${width}: 재료 견적 가로 넘침 0, 카드는 화면 안, 첫 로드 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await watchShifts(page);
    await gotoReady(page, "/market/quote");
    await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();
    const outside = await page.evaluate(() =>
      [...document.querySelectorAll("main section")]
        .map((el) => Math.round(el.getBoundingClientRect().right))
        .filter((right) => right > document.documentElement.clientWidth),
    );
    expect(outside, "화면 밖으로 나간 카드의 오른쪽 끝").toEqual([]);
    await expectNoHorizontalOverflow(page);
    // The price basis control has measured (fonts ready) by now.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const loaded = await shiftsSince(page);
    expect(loaded.all, `첫 로드 흔들림 (${loaded.moved})`).toBe(0);
  });
