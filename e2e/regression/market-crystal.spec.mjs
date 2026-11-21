// 회귀(PM 총괄 11-22 흡수 X6, 부분): 시세 화면의 블루 크리스탈 카드. 공식 경로만 — 공식 상점 비율(100개 = 로열 크리스탈
// 2,750개)과 기준 날짜, 교환소 시세는 공식으로 받을 곳이 없어 사용자가 넣는 값(로아샵 효율 계산기와 같은 값, 이 브라우저에만,
// 기본값 없음). 넣었을 때만 로열 크리스탈 1개 = 27,300 ÷ 2,750 = 9.927… → '약 9.93골드'. 값이 들어와도 카드 높이는 그대로.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const SHOP_RATE = /게임 안 크리스탈 교환소 시세\(블루 크리스탈 100개당 골드\)/;

for (const width of [320, 1280])
  test(`${width}: 블루 크리스탈 카드 — 공식 상점 비율, 내가 넣은 교환소 시세로만 계산, 로아샵과 같은 값 @regression`, async ({ page }) => {
    const sent = [];
    page.on("request", (request) => sent.push(`${request.url()} ${request.postData() ?? ""}`));
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/market");
    const card = page.getByRole("region", { name: "블루 크리스탈" });
    await expect(card).toContainText("100개 = 로열 크리스탈 2,750개");
    await expect(card).toContainText(/판매가 기준 · 확인 \d{4}-\d{2}-\d{2}/);
    await expect(card.getByRole("link", { name: "공식 상점" })).toHaveAttribute("href", /^https:\/\/lostark\.game\.onstove\.com\//);

    // No default: an empty field and no gold figure until the user types one.
    const field = card.getByRole("textbox", { name: /게임 안 교환소 시세/ });
    await expect(field).toHaveValue("");
    const royal = card.getByRole("definition").nth(1);
    await expect(royal).toContainText("—");
    await expect(royal).toContainText("교환소 시세를 넣으면 계산해요");
    await expect(royal).not.toContainText("골드");
    const height = (await card.boundingBox()).height;

    // Thousands commas are fine, and kept as typed.
    await field.fill("27,300");
    await expect(field).toHaveValue("27,300");
    await expect(royal).toContainText("약 9.93골드");
    await expect(field).not.toHaveAttribute("aria-invalid");
    await field.fill("27300");
    await expect(royal).toContainText("약 9.93골드");
    await expect(royal).toContainText("내가 넣은 교환소 시세 기준");
    expect((await card.boundingBox()).height, "값을 넣어도 카드 높이 그대로").toBeCloseTo(height, 0);

    // Phones: 44px to press — the field itself, and the two links' tap areas (hit-44, A36).
    if (width < 700) {
      expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(44);
      for (const name of ["공식 상점", "로아샵 효율 계산기에서 패키지 이득 보기"]) {
        const area = await card.getByRole("link", { name }).evaluate((el) => {
          const after = getComputedStyle(el, "::after");
          return { w: parseFloat(after.width), h: parseFloat(after.height) };
        });
        expect(area.h, `${name} 누르는 높이`).toBeGreaterThanOrEqual(44);
        expect(area.w, `${name} 누르는 폭`).toBeGreaterThanOrEqual(44);
      }
    }

    // Kept in this browser, and the 로아샵 계산기 reads the same value.
    await page.reload();
    await expect(page.getByRole("region", { name: "블루 크리스탈" }).getByRole("textbox", { name: /게임 안 교환소 시세/ })).toHaveValue("27300");
    await expect(page.getByRole("region", { name: "블루 크리스탈" }).getByRole("textbox", { name: /게임 안 교환소 시세/ })).not.toHaveAttribute("aria-invalid");
    await expect(page.getByRole("region", { name: "블루 크리스탈" }).getByRole("definition").nth(1)).toContainText("약 9.93골드");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("region", { name: "블루 크리스탈" }).getByRole("link", { name: "로아샵 효율 계산기에서 패키지 이득 보기" }).click();
    await expect(page).toHaveURL(/\/tools\/loa-shop$/);
    await expect(page.getByRole("textbox", { name: SHOP_RATE })).toHaveValue("27300");
    expect(sent.filter((line) => /27,?300|27%2C300/.test(line)), "입력한 시세를 서버로 보내지 않는다").toEqual([]);
  });

// codex P2 on #1889: a wrong value is never read as some other number ('-27300' was 27300, '1.5' was 15). It stays
// as typed, is marked invalid with its message tied to the field and read politely, and nothing is calculated — on
// the card and on the 로아샵 계산기 (the same value).
test("320: 교환소 시세가 잘못되면 다른 숫자로 읽지 않고, 오류 문구를 필드에 묶어 알린다(시세 · 로아샵) @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoReady(page, "/market");
  const card = page.getByRole("region", { name: "블루 크리스탈" });
  const field = card.getByRole("textbox", { name: /게임 안 교환소 시세/ });
  const royal = card.getByRole("definition").nth(1);
  const message = /1 이상의 정수로 넣어 주세요\. 쉼표는 세 자리마다 쓸 수 있어요\./;
  for (const typed of ["-27300", "1.5", "2,73,00", "0"]) {
    await field.fill(typed);
    await expect(field, typed).toHaveValue(typed);
    await expect(field, typed).toHaveAttribute("aria-invalid", "true");
    await expect(field, typed).toHaveAccessibleDescription(message);
    await expect(card.getByRole("status"), typed).toHaveText(message);
    await expect(royal, typed).toContainText("—");
    await expect(royal, typed).toContainText("넣은 값으로는 계산하지 않아요");
    await expect(royal, typed).not.toContainText("골드");
  }
  // The 로아샵 계산기 shows the same value as invalid and calculates no gain from it.
  await field.fill("-27300");
  await gotoReady(page, "/tools/loa-shop");
  const shopField = page.getByRole("textbox", { name: SHOP_RATE });
  await expect(shopField).toHaveValue("-27300");
  await expect(shopField).toHaveAttribute("aria-invalid", "true");
  await expect(shopField).toHaveAccessibleDescription(message);
  await expect(page.getByText("로열 크리스탈로 환산한 가치")).toHaveCount(0);
  // Fixed: the message goes, the field is valid again.
  await shopField.fill("27,300");
  await expect(shopField).not.toHaveAttribute("aria-invalid");
  await expect(page.getByText(message)).toHaveCount(0);
});
