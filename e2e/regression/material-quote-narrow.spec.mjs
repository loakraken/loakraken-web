// 회귀(v0.3.2 P2): 320에서 재료 구매 견적 본문이 26px 가로로 넘쳤다(카드를 담는 grid 열이 자동 크기라
// 이름 입력칸의 기본 폭 300px만큼 카드가 넓어짐). 320·360·390·1280에서 가로 넘침 0, 카드는 화면 안
// (넓은 화면도 입력칸 폭 규칙이 바뀐 뒤 넘치지 않는지 함께 본다).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

for (const width of [320, 360, 390, 1280])
  test(`@견적좁은폭 ${width}: 재료 견적 가로 넘침 0, 카드는 화면 안 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await gotoReady(page, "/tools/material-quote");
    await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();
    const outside = await page.evaluate(() =>
      [...document.querySelectorAll("main section")]
        .map((el) => Math.round(el.getBoundingClientRect().right))
        .filter((right) => right > document.documentElement.clientWidth),
    );
    expect(outside, "화면 밖으로 나간 카드의 오른쪽 끝").toEqual([]);
    await expectNoHorizontalOverflow(page);
  });
