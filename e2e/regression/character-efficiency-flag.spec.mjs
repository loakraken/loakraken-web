// 회귀(PM 총괄 10-17): 캐릭터 화면 '아크 그리드 효율'·'팔찌 효율'은 운영 호스트에서만 숨긴다
// (CHARACTER_EFFICIENCY=on|off가 우선). 평소 실행(로컬·CI·스테이징)은 두 줄이 보이고, 웹 서버를
// SITE_URL=운영 호스트로 띄우면 두 줄도 줄별 보기도 통째로 없고 그 자리에 빈칸도 없다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const site = (process.env.SITE_URL ?? "").trim().toLowerCase();
const flag = (process.env.CHARACTER_EFFICIENCY ?? "").trim().toLowerCase();
const hidden = flag === "off" || (flag !== "on" && /^https?:\/\/(www\.)?loakraken\.gg(\/|:|$)/.test(site));

for (const width of [1280, 360])
  test(`@flag ${width} 아크 그리드·팔찌 효율: ${hidden ? "운영에서는 통째로 없음" : "평소에는 보임"} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세"));
    const ark = page.getByRole("button", { name: /^아크 그리드 효율/ });
    const bracelet = page.getByRole("button", { name: /^팔찌 효율/ });
    if (!hidden) {
      await expect(ark).toBeVisible();
      await expect(bracelet).toBeVisible();
      return;
    }
    // The panels themselves are there (the character data is), only the efficiency is not.
    await expect(page.getByText("아크 그리드", { exact: true }).first()).toBeVisible();
    await expect(ark).toHaveCount(0);
    await expect(bracelet).toHaveCount(0);
    await expect(page.getByRole("button", { name: /줄별 보기$/ })).toHaveCount(0);
    await expect(page.getByText(/전투력을 몇 % 올려 주는지/)).toHaveCount(0);
  });
