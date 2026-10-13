// 로아샵 효율(/tools/loa-shop, 체크리스트 L45). 패키지 구성·판매가·판매 기간은 공식 상점 공지,
// 블루 크리스탈 100개 = 로열 크리스탈 2,750은 공식 상점. 재료 시세는 목 서버 합성 시세라
// 값 자체가 아니라 계산 관계와 표시 규칙(미확인, 교환소 시세가 없으면 이득 없음)을 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const RATE = /게임 안 크리스탈 교환소 시세\(블루 크리스탈 100개당 골드\)/;

test.describe("로아샵 효율 @smoke", () => {
  test("교환소 시세가 없으면 골드 가치와 판매가만, 기준일·판매 기간·구매 보너스 문구는 공지 그대로", async ({ page }) => {
    await gotoReady(page, "/tools/loa-shop");
    await expect(page.getByRole("heading", { level: 1, name: "로아샵 효율" })).toBeVisible();
    await expect(page.getByText(/공식 상점 공지 기준 · 확인 2026-10-13/)).toBeVisible();
    const growth = page.getByRole("region", { name: "[3+1] 월간 운명의 성장 패키지+" });
    await expect(growth.getByText("3회 구매 + 보너스 = 4세트 기준 (1회 33,000)")).toBeVisible();
    await expect(growth.getByText("본 상품 3회 구매 시, 동일한 구성품의 보너스 상품을 추가 지급합니다.")).toBeVisible();
    await expect(growth.getByText("2026년 8월 19일(수) 정기 점검 후 ~ 별도 안내 시")).toBeVisible();
    await expect(page.getByRole("textbox", { name: RATE })).toHaveValue("");
    await expect(page.getByText(/로열 크리스탈로 환산한 가치/)).toHaveCount(0);
    await expect(page.getByText("교환소 시세를 넣으면 이득을 계산해요.").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("시세가 없는 구성품은 0이 아니라 미확인이고, 그 패키지는 이득을 계산하지 않는다", async ({ page }) => {
    await gotoReady(page, "/tools/loa-shop");
    await page.getByRole("textbox", { name: RATE }).fill("27300");
    const growth = page.getByRole("region", { name: "[3+1] 월간 운명의 성장 패키지+" });
    // 목 서버에서 용암의 숨결은 시세가 없다.
    await expect(growth.getByRole("row", { name: /^용암의 숨결/ })).toContainText("미확인");
    await expect(growth.getByText("확인된 구성품 합계")).toBeVisible();
    await expect(growth.getByText("미확인 구성품이 있어 이득을 계산하지 않았어요.")).toBeVisible();
  });

  test("교환소 시세를 넣으면 공식 크리스탈 경로로 이득을 내고, 이 브라우저에만 남는다", async ({ page }) => {
    const sent = [];
    page.on("request", (request) => sent.push(`${request.url()} ${request.postData() ?? ""}`));
    await gotoReady(page, "/tools/loa-shop");
    await page.getByRole("textbox", { name: RATE }).fill("27300");
    const pass = page.getByRole("region", { name: "[한정] 아이템 레벨 1,700 달성" });
    // 2,600 크리스탈 × 273G = 709,800G → × 2,750 ÷ 27,300 = 71,500 로열 크리스탈, 판매가 55,000.
    await expect(pass.getByText("로열 크리스탈로 환산한 가치 71,500")).toBeVisible();
    await expect(pass.getByText(/\+16,500/)).toBeVisible();
    await expect(pass.getByText("같은 로열 크리스탈로 공식 상점에서 크리스탈을 사면 2,000개, 이 상품은 2,600개예요.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: RATE })).toHaveValue("27300");
    expect(sent.filter((line) => line.includes("27300")), "입력한 시세를 서버로 보내지 않는다").toEqual([]);
  });
});
