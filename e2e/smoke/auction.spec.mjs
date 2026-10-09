// 경매 입찰가(web #72·#81). 계산 기준은 일로아 /tools/bid(lib/tools/auction.ts 주석):
// 수수료 5%(올림), 판매 손익 분기 = (가격 − 수수료) × (n−1)/n, 직접 사용 = 가격 × (n−1)/n,
// 선점 = 판매 손익 분기 ÷ 1.1, 금액은 골드 단위 내림.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const priceBox = (page) => page.getByRole("textbox", { name: "아이템 가격 (거래소 최저가)" });
const customParty = (page) => page.getByRole("textbox", { name: /직접 입력/ }).or(page.getByRole("spinbutton", { name: /직접 입력/ }));
const bidRow = (page, name) => page.getByRole("region", { name: "입찰가" }).getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${name}`) }) });

test.describe("경매 입찰가 @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/auction");
    await expect(page.getByRole("heading", { level: 1, name: "경매 입찰가" })).toBeVisible();
  });

  test("일로아 대조 100,000G·8인", async ({ page }) => {
    await priceBox(page).fill("100,000");
    const summary = page.getByRole("region", { name: "요약" });
    await expect(summary).toContainText("83,125G"); // 판매 손익 분기
    await expect(summary).toContainText("87,500G"); // 직접 사용 손익 분기
    await expect(summary).toContainText("95,000G"); // 판매하면 받는 골드
    await expect(summary).toContainText("5,000G"); // 수수료
    await expect(summary).toContainText("11,875G"); // 1인 분배금 = 83,125 ÷ 7 내림
    await expect(bidRow(page, "선점")).toContainText("75,568"); // 83,125 ÷ 1.1 내림
    await expectNoHorizontalOverflow(page);
  });

  test("수수료는 올림이다: 99,999G·8인", async ({ page }) => {
    await priceBox(page).fill("99999");
    const summary = page.getByRole("region", { name: "요약" });
    await expect(summary).toContainText("5,000G"); // 4,999.95 → 5,000
    await expect(summary).toContainText("83,124G"); // 94,999 × 7/8 내림
    await expect(bidRow(page, "선점")).toContainText("75,567");
  });

  const PRESETS = [
    ["4인", 75_000, 71_250], // 직접 사용 100,000×3/4, 판매 95,000×3/4
    ["8인", 87_500, 83_125],
    ["16인", 93_750, 89_062], // 95,000×15/16 = 89,062.5 내림
    ["30인", 96_666, 91_833], // 100,000×29/30 = 96,666.7, 95,000×29/30 = 91,833.3
  ];
  for (const [label, useMyself, breakEven] of PRESETS) {
    test(`프리셋 ${label}`, async ({ page }) => {
      await priceBox(page).fill("100000");
      await page.getByRole("group", { name: "파티 인원" }).getByText(label, { exact: true }).click();
      await expect(page.getByRole("radio", { name: label })).toBeChecked();
      const summary = page.getByRole("region", { name: "요약" });
      await expect(summary).toContainText(`${useMyself.toLocaleString("ko-KR")}G`);
      await expect(summary).toContainText(`${breakEven.toLocaleString("ko-KR")}G`);
    });
  }

  test("직접 입력: 범위 안이면 그 인원으로 계산한다", async ({ page }) => {
    await priceBox(page).fill("100000");
    await customParty(page).fill("6");
    // 6인: 직접 사용 100,000×5/6 = 83,333, 판매 95,000×5/6 = 79,166
    const summary = page.getByRole("region", { name: "요약" });
    await expect(summary).toContainText("83,333G");
    await expect(summary).toContainText("79,166G");
    await expect(customParty(page)).not.toHaveAttribute("aria-invalid", "true");
  });

  for (const value of ["1", "31", "abc"]) {
    test(`직접 입력 '${value}'은 범위 오류를 알리고 계산하지 않는다`, async ({ page }) => {
      await priceBox(page).fill("100000");
      await customParty(page).fill(value);
      await expect(page.getByRole("alert").filter({ hasText: "2~30명 사이로 입력해 주세요." })).toBeVisible();
      await expect(customParty(page)).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("인원을 2~30명으로 고치면 계산해요.")).toBeVisible();
    });
  }

  const PRICE_ERRORS = [
    ["12a", "숫자만 입력해 주세요."],
    ["0", "1골드 이상 입력해 주세요."],
    ["1000000001", "10억 골드 이하로 입력해 주세요."],
  ];
  for (const [value, message] of PRICE_ERRORS) {
    test(`가격 '${value}'은 '${message}'`, async ({ page }) => {
      await priceBox(page).fill(value);
      await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
      await expect(priceBox(page)).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("region", { name: "요약" })).toContainText("—");
    });
  }

  test("파티 인원을 화살표 키로 고른다", async ({ page }) => {
    await page.getByRole("radio", { name: "8인" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "16인" })).toBeChecked();
  });

  test("계산 조건이 주소에 남아 새로고침해도 유지된다", async ({ page }) => {
    await priceBox(page).fill("100000");
    await page.getByRole("group", { name: "파티 인원" }).getByText("4인", { exact: true }).click();
    await expect(page).toHaveURL(/price=100000/);
    await expect(page).toHaveURL(/party=4/);
    await page.reload();
    await expect(priceBox(page)).toHaveValue(/100,?000/);
    await expect(page.getByRole("radio", { name: "4인" })).toBeChecked();
    await expect(page.getByRole("region", { name: "요약" })).toContainText("71,250G");
  });
});
