// 회귀(지인 피드백 #17, 사용자 10-31): 내실 탭 수집품 아이콘은 공식 전투정보실 스프라이트의 작은 아이콘(공식 화면과
// 같은 그림, 원래 크기로 32px 칸 가운데). 공식 종류가 아니면 API 배지(여기서는 없음). 칸 크기는 같아 흔들림 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [360, 1280])
  test(`${width}: 수집품은 공식 스프라이트 아이콘, 공식 종류가 아니면 배지 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세", "collectibles"));
    const panel = page.getByRole("region", { name: "수집품", exact: true });
    const sprite = (type) => panel.locator(`[data-sprite-type="${type}"]`);
    await expect(sprite("모코코 씨앗")).toHaveCount(1);
    const icon = await sprite("모코코 씨앗").evaluate((box) => {
      const inner = box.firstElementChild;
      const style = getComputedStyle(inner);
      return {
        box: [box.offsetWidth, box.offsetHeight],
        size: [inner.offsetWidth, inner.offsetHeight],
        image: style.backgroundImage.includes("cdn-lostark.game.onstove.com/2018/obt/assets/images/pc/sprite/sprite_profile.png"),
        position: style.backgroundPosition,
      };
    });
    // Native size (crisp, as the official page draws it) in the old 32px box.
    expect(icon).toEqual({ box: [32, 32], size: [23, 22], image: true, position: "-234px -92px" });
    for (const type of ["거인의 심장", "섬의 마음", "위대한 미술품", "항해 모험물"]) await expect(sprite(type)).toHaveCount(1);
    // Not an official type: no sprite (the API badge, none in the mock).
    await expect(sprite("합성 잎")).toHaveCount(0);
    await page.waitForTimeout(600);
    const { quiet, moved } = await shiftsSince(page);
    expect(quiet, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
