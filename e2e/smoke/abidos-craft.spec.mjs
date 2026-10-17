// 아비도스 제작 손익(/tools/abidos-craft, 체크리스트 M46·N10). 재료·골드·활동력은 제작 데이터베이스,
// 1회 10개·대성공 20개(사이트 스크립트 output 10)·대성공 5% × (1 + 증가). 시세는 목 서버 합성
// 시세라 값 자체가 아니라 계산 관계와 표시 규칙을 본다. 교환 상인은 기본으로 켜져 있다(비교 기준 C와 같음).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

// Phones fold the conditions under the results (A23): open them before typing.
async function openConditions(page) {
  const toggle = page.getByRole("button", { name: /^계산 조건/ });
  if (await toggle.isVisible()) await toggle.click();
}

test.describe("아비도스 제작 손익 @smoke", () => {
  test("교환 상인이 켜져 있으면 더 싼 교환 값으로 재료비를 계산하고, 무엇을 교환으로 마련하는지 적는다", async ({ page }) => {
    await gotoReady(page, "/tools/abidos-craft");
    await openConditions(page);
    await expect(page.getByRole("switch", { name: "교환 상인" })).toBeChecked();
    const normal = page.getByRole("region", { name: "아비도스 융화 재료", exact: true });
    // 목 시세 벌목: 튼튼한 목재 6 → 목재 0.6 → 가루 0.75 → 아비도스 목재 7.5·부드러운 목재 1.5.
    // 33 × 7.5 + 45 × 1.5 + 86 × 0.6 + 400 = 766.6.
    const logging = normal.getByRole("row", { name: /^벌목/ });
    await expect(logging.getByRole("cell").nth(0)).toHaveText("767");
    await expect(logging).toContainText("교환으로 마련: 아비도스 목재, 부드러운 목재, 목재");
    // 생선은 시세가 없지만 붉은 살 생선 25 → 생선 50으로 마련돼 원가가 나온다.
    const fishing = normal.getByRole("row", { name: /^낚시/ });
    await expect(fishing.getByRole("cell").nth(0)).toHaveText("1,067");
    await expect(fishing).toContainText("교환으로 마련: 생선");
    await expectNoHorizontalOverflow(page);
  });

  test("교환 상인을 끄면 생활 스킬별 1회 손익을 거래소 값으로 보여 주고, 시세가 없는 재료는 미확인으로 둔다", async ({ page }) => {
    await gotoReady(page, "/tools/abidos-craft");
    await openConditions(page);
    await expect(page.getByRole("heading", { level: 1, name: "아비도스 제작 손익" })).toBeVisible();
    await page.getByRole("switch", { name: "교환 상인" }).click();
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
    // 판매 시: 개당 판매 수수료 ⌈90 × 5%⌉ = 5를 떼고 × 10.5 → 892.5 − 996 = −103.5 → −103(.5는 + 쪽으로, 비교 기준과 같음), 100당 −35.9 → −36.
    await expect(logging.getByRole("cell").nth(1)).toHaveText("−103100 활동력당 −36");
    // 목 서버에 "생선" 시세가 없다.
    const fishing = normal.getByRole("row", { name: /^낚시/ });
    await expect(fishing).toContainText("미확인: 생선");
    await expect(fishing.getByRole("cell").nth(0)).toHaveText("미확인");
    await expectNoHorizontalOverflow(page);
  });

  test("대성공 확률 증가와 수수료 감소를 넣으면 평균 개수와 제작 골드가 바뀐다", async ({ page }) => {
    await gotoReady(page, "/tools/abidos-craft");
    await openConditions(page);
    await page.getByRole("switch", { name: "교환 상인" }).click();
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

  // QA 10-16 · PM 총괄 10-17(A23): 좁은 화면 첫 화면에 결과가 먼저 나오고, 계산 조건은 현재 값 한 줄 요약과 함께
  // 접혀 있다. 펼쳐도 결과(위)는 움직이지 않는다(A7).
  test("좁은 화면에서는 결과가 먼저이고, 계산 조건은 요약과 함께 접혀 있다", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoReady(page, "/tools/abidos-craft");
    const results = page.getByRole("heading", { level: 2, name: "1회 제작 손익" });
    const toggle = page.getByRole("button", { name: /^계산 조건/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toContainText("대성공 +0% · 수수료 −0% · 활동력 −0% · 교환 상인 켬");
    await expect(page.getByRole("textbox", { name: "대성공 확률 증가" })).toBeHidden();
    expect((await results.boundingBox()).y).toBeLessThan((await toggle.boundingBox()).y);
    const docY = () => results.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const before = await docY();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("textbox", { name: "대성공 확률 증가" })).toBeVisible();
    expect(await docY()).toBeCloseTo(before, 0);
    await page.getByRole("textbox", { name: "제작 수수료 감소" }).fill("17");
    await expect(toggle).toContainText("수수료 −17%");
  });
});
