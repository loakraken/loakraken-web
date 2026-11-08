// 회귀(사용자 11-08): 캐릭터 이미지의 무기·스킬 효과가 공식 그림의 가장자리나 상자에서 곧은 선으로 잘려 붙여 넣은 것처럼
// 보였다. 이제 캐릭터 그림을 보여 주는 곳(랭킹 단상, 캐릭터 배너, 아바타 탭)이 한 부품(CharacterPortrait)을 써서 네
// 가장자리가 부드럽게 사라진다. 단상은 그림을 자르지 않고 칸 높이에 통째로, 배너는 캐릭터 크기 그대로 상자 네 변이
// 흐려진다. 그림이 와도 칸 크기는 그대로이고(흔들림 0) 휴대폰에서 옆으로 넘치지 않는다.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

/** The image's fades: its own mask (two gradients, across and down) and its placement. */
const fadeOf = (image) =>
  image.evaluate((el) => {
    const style = getComputedStyle(el);
    const mask = style.maskImage || style.webkitMaskImage || "";
    return { fade: el.dataset.fade, gradients: (mask.match(/linear-gradient/g) ?? []).length };
  });

for (const width of [1280, 390, 320])
  test(`@A7 ${width} 캐릭터 그림: 단상·배너·아바타 탭 모두 가장자리가 부드럽고 칸 크기 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    // The rankings podium: the whole render at the slot height, never wider than the card shows.
    await gotoReady(page, "/rankings");
    const podium = page.locator("[data-podium-state]");
    await expect(podium).toHaveAttribute("data-podium-state", "ready");
    const images = podium.locator("img[data-podium-image]");
    await expect(images).toHaveCount(3);
    for (const image of await images.all()) {
      expect(await fadeOf(image)).toEqual({ fade: "card", gradients: 2 });
      const fit = await image.evaluate((el) => {
        const box = el.parentElement.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        // + 0: a rounded -0 would not equal 0.
        return { top: Math.round(r.top - box.top) + 0, height: Math.round(r.height - box.height) + 0, centre: Math.round(r.left + r.width / 2 - (box.left + box.width / 2)) + 0 };
      });
      expect(fit, "단상 그림: 칸 맨 위, 칸 높이, 가운데").toMatchObject({ top: 0, height: 0, centre: 0 });
    }
    await expectNoHorizontalOverflow(page);

    // The character banner: the render's own sides fade, and its box fades on all four sides.
    await gotoReady(page, characterPath("상세"));
    const banner = page.getByRole("region", { name: /캐릭터 요약$/ });
    const render = banner.getByRole("img", { name: /캐릭터 전신$/ });
    await expect(render).toBeVisible();
    expect(await fadeOf(render)).toEqual({ fade: "banner", gradients: 2 });
    const figure = await render.evaluate((el) => {
      const style = getComputedStyle(el.parentElement);
      return style.maskImage || style.webkitMaskImage || "";
    });
    // The down fade starts transparent (the band's top edge fades too), then the across fade.
    expect(figure.startsWith("linear-gradient(rgba(0, 0, 0, 0), rgb(0, 0, 0) 14%"), `배너 상자: 위에서도 흐려짐 (${figure})`).toBe(true);
    expect(figure, "배너 상자: 양옆도 흐려짐").toContain("linear-gradient(90deg, rgba(0, 0, 0, 0), rgb(0, 0, 0) 12%");
    await expectNoHorizontalOverflow(page);

    // The avatar tab's stage.
    await gotoReady(page, characterPath("상세", "avatars"));
    const stage = page.getByRole("img", { name: /캐릭터 전신\(장착한 아바타\)$/ });
    await expect(stage).toBeVisible();
    expect(await fadeOf(stage)).toEqual({ fade: "stage", gradients: 2 });
    await expectNoHorizontalOverflow(page);
  });
