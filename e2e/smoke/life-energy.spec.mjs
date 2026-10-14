// 생명의 기운 효율(/tools/life-energy, 체크리스트 M61). 만 기운당 획득 수·교환 규칙은 허용 단일 출처의
// 스크립트 데이터, 제작은 아비도스 제작 손익과 같은 데이터. 시세는 목 서버 합성 시세라 값 자체가 아니라
// 계산 관계와 표시 규칙을 본다(목 서버에 "생선"이 없어 낚시는 미확인).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

test.describe("생명의 기운 효율 @smoke", () => {
  test("입력 없이 1만 기운으로 생활 스킬을 버는 골드 순서로 보여 주고, 시세가 없으면 미확인으로 둔다", async ({ page }) => {
    await gotoReady(page, "/tools/life-energy");
    await expect(page.getByRole("heading", { level: 1, name: "생명의 기운 효율" })).toBeVisible();
    // 목 시세에서 벌목 1만 기운 = 상급 14번 만들어 팔기 31,955.35.
    await expect(page.getByText("벌목에 쓰면 31,955골드로 가장 많이 벌어요")).toBeVisible();
    await expect(page.getByText("상급 아비도스 융화 재료 14번 만들어 팔기").first()).toBeVisible();
    // 하루 4,320 → 31,955.35 ÷ 10,000 × 4,320 = 13,804.7.
    await expect(page.getByText("하루 생기(4,320)로 버는 골드")).toBeVisible();
    await expect(page.getByText("13,805", { exact: true })).toBeVisible();
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows.nth(1)).toContainText("벌목");
    await expect(rows.nth(1).getByRole("cell").nth(0)).toHaveText("31,955");
    // 벌목 9분/만 기운.
    await expect(rows.nth(1).getByRole("cell").nth(1)).toHaveText("9분");
    const fishing = page.getByRole("row", { name: /^낚시/ });
    await expect(fishing).toContainText("미확인: 생선");
    await expect(fishing.getByRole("cell").nth(0)).toHaveText("미확인");
    await expect(rows.last()).toContainText("낚시");
    await expectNoHorizontalOverflow(page);
  });

  test("기운·축복·수수료 감소·직접 쓰기를 바꾸면 다시 계산한다", async ({ page }) => {
    await gotoReady(page, "/tools/life-energy");
    await expect(page.getByText("벌목에 쓰면 31,955골드로 가장 많이 벌어요")).toBeVisible();
    await page.getByRole("switch", { name: "베아트리스의 축복" }).click();
    await expect(page.getByText("하루 생기(4,752)로 버는 골드")).toBeVisible();
    await page.getByRole("textbox", { name: "제작 수수료 감소" }).fill("17");
    await expect(page.getByText("벌목에 쓰면 33,187골드로 가장 많이 벌어요")).toBeVisible();
    await page.getByRole("textbox", { name: "제작 수수료 감소" }).fill("");
    await page.getByRole("radio", { name: "직접 쓰기" }).click();
    await expect(page.getByText("벌목에 쓰면 34,013골드로 가장 많이 벌어요")).toBeVisible();
    await expect(page.getByText("상급 아비도스 융화 재료 14번 만들어 쓰기").first()).toBeVisible();
    await page.getByRole("radio", { name: "팔기" }).click();
    // 1,000 기운: 식물채집은 한 번도 못 만들어 재료 판매.
    await page.getByRole("textbox", { name: "쓸 생명의 기운" }).fill("1000");
    await expect(page.getByText("벌목에 쓰면 2,557골드로 가장 많이 벌어요")).toBeVisible();
    await expect(page.getByRole("row", { name: /^식물채집/ })).toContainText("캔 재료 그대로 팔기");
    await page.getByRole("textbox", { name: "쓸 생명의 기운" }).fill("0");
    await expect(page.getByText("1~1,000,000 사이 정수로 넣어 주세요.")).toBeVisible();
  });

  // PM-프론트 측정(#806, 360 0.0093): 기운을 바꾸면 방법 줄 길이가 바뀌어(재료 판매 ↔ 상급 N번 만들어 팔기)
  // 좁은 화면에서 표 줄 높이가 달라졌다. 두 줄을 미리 잡아 두어, 입력 중에도 이동이 0이어야 한다.
  test("좁은 화면에서 기운을 넣었다 지워도 결과 표가 움직이지 않는다", async ({ page }) => {
    // Tall enough that the whole table is in view, so every shift is counted.
    await page.setViewportSize({ width: 360, height: 2400 });
    await gotoReady(page, "/tools/life-energy");
    await expect(page.getByText("벌목에 쓰면 31,955골드로 가장 많이 벌어요")).toBeVisible();
    await page.evaluate(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__shifts.push(e.value);
      }).observe({ type: "layout-shift" });
    });
    const input = page.getByRole("textbox", { name: "쓸 생명의 기운" });
    await input.pressSequentially("123", { delay: 100 });
    await expect(page.getByText(/^생명의 기운 123으로 벌면$/)).toBeVisible();
    for (let i = 0; i < 3; i++) await input.press("Backspace");
    await expect(page.getByText("벌목에 쓰면 31,955골드로 가장 많이 벌어요")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__shifts)).toEqual([]);
  });
});
