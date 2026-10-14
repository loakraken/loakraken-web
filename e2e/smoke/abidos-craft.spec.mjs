// 아비도스 제작 손익(/tools/abidos-craft, 체크리스트 M46·N10). 재료·골드·활동력은 제작 데이터베이스,
// 1회 10개·대성공 20개(사이트 스크립트 output 10)·대성공 5% × (1 + 증가). 시세는 목 서버 합성
// 시세라 값 자체가 아니라 계산 관계와 표시 규칙을 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

test.describe("아비도스 제작 손익 @smoke", () => {
  test("입력 없이 생활 스킬별 1회 손익을 보여 주고, 시세가 없는 재료는 미확인으로 둔다", async ({ page }) => {
    await gotoReady(page, "/tools/abidos-craft");
    await expect(page.getByRole("heading", { level: 1, name: "아비도스 제작 손익" })).toBeVisible();
    const normal = page.getByRole("region", { name: "아비도스 융화 재료", exact: true });
    await expect(normal.getByText("활동력 288 · 제작 1:00 · 골드 400")).toBeVisible();
    // 목 시세: 벌목 재료 10·4·1, 결과물 90 → 비용 33×10 + 45×4 + 86×1 + 400 = 996, 평균 10.5개.
    const logging = normal.getByRole("row", { name: /^벌목/ });
    await expect(logging.getByRole("cell").nth(0)).toHaveText("996");
    // 직접 사용 이익과 그 아래 100 활동력당(기본 활동력 288) 줄.
    // 945 − 996 = −51: at these synthetic prices the craft loses gold.
    const use = 10.5 * 90 - 996;
    await expect(logging.getByRole("cell").nth(2)).toHaveText(`−${Math.abs(use).toLocaleString("ko-KR")}100 활동력당 −${Math.abs(Math.round((use * 100) / 288)).toLocaleString("ko-KR")}`);
    await expect(normal.getByRole("columnheader", { name: /^직접 사용 시\s*100 활동력당$/ })).toBeVisible();
    // 목 서버에 "생선" 시세가 없다.
    const fishing = normal.getByRole("row", { name: /^낚시/ });
    await expect(fishing).toContainText("미확인: 생선");
    await expect(fishing.getByRole("cell").nth(0)).toHaveText("미확인");
    await expectNoHorizontalOverflow(page);
  });

  test("대성공 확률 증가와 수수료 감소를 넣으면 평균 개수와 제작 골드가 바뀐다", async ({ page }) => {
    await gotoReady(page, "/tools/abidos-craft");
    await page.getByRole("textbox", { name: "대성공 확률 증가" }).fill("100");
    await expect(page.getByText("대성공 확률 10% · 1회 평균 11개")).toBeVisible();
    await page.getByRole("textbox", { name: "제작 수수료 감소" }).fill("17");
    await expect(page.getByText(/1회 제작 골드 아비도스 332 · 상급 아비도스 432/)).toBeVisible();
    const logging = page.getByRole("region", { name: "아비도스 융화 재료", exact: true }).getByRole("row", { name: /^벌목/ });
    // 비용 596 + 332 = 928, 직접 사용 11 × 90 − 928 = 62.
    await expect(logging.getByRole("cell").nth(0)).toHaveText("928");
    await expect(logging.getByRole("cell").nth(2)).toHaveText(new RegExp(`^\\+${(11 * 90 - 928).toLocaleString("ko-KR")}100 활동력당`));
    // 활동력 소모 감소: 전체 10 + 특수 10 = 20% → 288 × 0.8 = 230.4 → 230, 360 × 0.8 = 288.
    await page.getByRole("textbox", { name: "활동력 소모 감소(전체)" }).fill("10");
    await page.getByRole("textbox", { name: "활동력 소모 감소(특수 제작)" }).fill("10");
    await expect(page.getByText("1회 활동력 아비도스 230 · 상급 아비도스 288 (내림)")).toBeVisible();
    await expect(page.getByRole("region", { name: "아비도스 융화 재료", exact: true }).getByText(/^활동력 230 · /)).toBeVisible();
    await page.getByRole("textbox", { name: "대성공 확률 증가" }).fill("150");
    await expect(page.getByText("0~100 사이 숫자(소수 한 자리까지)로 넣어 주세요.")).toBeVisible();
  });
});
