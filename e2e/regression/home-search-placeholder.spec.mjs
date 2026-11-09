// 회귀(A37, v0.3.10 RC): 휴대폰 홈 히어로 검색칸의 안내 글('캐릭터 이름을 입력하세요')이 '캐릭터 검색' 단추 밑에서
// 잘리지 않는다. 320에서 칸 153px에 글 160px이라 '…입력하세요'의 끝이 단추 아래로 잘렸다(깨기 전, 운영도 같음).
// 단추는 누르기 쉬운 크기(44px 이상)를 지킨다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

for (const width of [320, 340, 360, 375, 390, 414, 430])
  test(`@A37 ${width} 홈 검색칸 안내 글이 단추 밑에서 잘리지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/");
    const hero = page.locator('section[aria-labelledby="hero-heading"]');
    const field = hero.getByRole("textbox", { name: "캐릭터 이름", exact: true });
    const submit = hero.getByRole("button", { name: "캐릭터 검색" });
    await expect(field).toBeVisible();
    await expect(submit).toBeVisible();
    // The placeholder's drawn width (the field's own font, once web fonts are in) against the field's text box.
    const fit = await field.evaluate(async (input) => {
      await document.fonts.ready;
      const style = getComputedStyle(input);
      const context = document.createElement("canvas").getContext("2d");
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text = Math.ceil(context.measureText(input.placeholder).width);
      const box = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const button = input.form.querySelector('button[type="submit"]').getBoundingClientRect();
      return { text, box, beforeButton: input.getBoundingClientRect().right <= button.left + 0.5 };
    });
    expect(fit.text, `안내 글 ${fit.text}px, 칸 ${fit.box}px`).toBeLessThanOrEqual(fit.box);
    expect(fit.beforeButton, "칸은 단추 앞에서 끝남").toBe(true);
    const button = await submit.boundingBox();
    expect(button.width, "단추 너비").toBeGreaterThanOrEqual(44);
    expect(button.height, "단추 높이").toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
  });
