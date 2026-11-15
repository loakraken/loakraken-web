// 회귀 가드(#1657 검토 P3): 보석 · 장신구 칸의 '최저가 추이' 기간 줄은 시장 첫 화면 훑기가 첫 화면만 잘라 보아
// 잘린다는 보장이 없었다. 이 줄을 직접 잘라 본다: 첫 HTML이 줄의 시작 태그 뒤 · 단추 사이 어디서 끊겨 와도 줄과
// 이미 그려진 것이 움직이지 않는다. 지금은 세 겹이 지킨다 — 줄은 끝 표시가 올 때까지 그리지 않고(data-fp-whole),
// 줄 폭은 글자 수로(#1657), 머리 높이는 단추 한 줄로(700px 이상). 휴대폰 · 터치 화면에서는 단추마다 44px 이상이라
// 줄 폭이 넓은 화면과 다르므로, 굵은 포인터 태블릿에서도 본다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const PAGES = [
  ["보석 칸", "/market/gems?kind=겁화&level=10", "10레벨 겁화 최저가 추이"],
  ["보석 칸 고르기 전", "/market/gems", "최저가 추이"],
  ["장신구 칸", "/market/accessories?slot=NECKLACE&levels=HIGH,HIGH", /최저가 추이$/],
];

const probe = async (page, url, name) => {
  await gotoReady(page, url);
  const box = page.getByRole("region", { name, exact: typeof name === "string" || undefined });
  await expect(box.getByRole("group", { name: "기간" }).getByRole("button")).toHaveCount(4);
  // Every start tag and text node of the trend box (title, the period row and its buttons), cut and put back
  // in page order; the box is brought into view first.
  const cut = await cutEverywhere(page, '[class*="cellTrend"]|최저가 추이');
  expect(cut.probed, "잘라 본 곳").toBeGreaterThan(5);
  expect(cut.value, `움직인 것: ${cut.moved.join(" / ")}`).toBe(0);
  return box;
};

for (const width of [1280, 360, 320])
  for (const [label, url, name] of PAGES)
    test(`@A7 ${width} ${label}: 최저가 추이 기간 줄이 어디서 끊겨 와도 움직이지 않는다 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await probe(page, url, name);
    });

test.describe("터치 태블릿(굵은 포인터, 단추 44px)", () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });
  for (const [label, url, name] of PAGES)
    test(`@A7 768 터치 ${label}: 최저가 추이 기간 줄이 어디서 끊겨 와도 움직이지 않는다 @regression`, async ({ page }) => {
      await gotoReady(page, url);
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), "굵은 포인터").toBe(true);
      const box = await probe(page, url, name);
      // The coarse-pointer rule is the one in force: every button is at least 44 px wide (its hit area is 44 px
      // tall through ::after; the drawn button stays 28 px).
      for (const button of await box.getByRole("group", { name: "기간" }).getByRole("button").all())
        expect((await button.boundingBox()).width, "단추 폭 44px 이상").toBeGreaterThanOrEqual(44);
    });
});
