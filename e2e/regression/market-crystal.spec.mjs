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
    await expect(card).not.toContainText("골드");
    const height = (await card.boundingBox()).height;

    await field.fill("27,300");
    await expect(field).toHaveValue("27300");
    await expect(royal).toContainText("약 9.93골드");
    await expect(royal).toContainText("내가 넣은 교환소 시세 기준");
    expect((await card.boundingBox()).height, "값을 넣어도 카드 높이 그대로").toBeCloseTo(height, 0);

    // Kept in this browser, and the 로아샵 계산기 reads the same value.
    await page.reload();
    await expect(page.getByRole("region", { name: "블루 크리스탈" }).getByRole("textbox", { name: /게임 안 교환소 시세/ })).toHaveValue("27300");
    await expect(page.getByRole("region", { name: "블루 크리스탈" }).getByRole("definition").nth(1)).toContainText("약 9.93골드");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("region", { name: "블루 크리스탈" }).getByRole("link", { name: "로아샵 효율 계산기에서 패키지 이득 보기" }).click();
    await expect(page).toHaveURL(/\/tools\/loa-shop$/);
    await expect(page.getByRole("textbox", { name: SHOP_RATE })).toHaveValue("27300");
    expect(sent.filter((line) => line.includes("27300")), "입력한 시세를 서버로 보내지 않는다").toEqual([]);
  });
