// 성장 도구 3종: 재련 기대 비용, 재료 구매 견적, 치적·뭉가·음돌.
// 모든 수치는 목 서버의 합성 값이라 값 자체가 아니라 흐름과 상태를 확인한다.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

test.describe("재련 기대 비용 @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/refining");
    await expect(page.getByRole("heading", { level: 1, name: "재련 기대 비용" })).toBeVisible();
  });

  test("모든 부위 목표를 고르면 바로 계산한다", async ({ page }) => {
    await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
    // 6부위 × (+18 → +20) = 12단계
    await expect(page.getByText(/총 12단계/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "필요 재료" }).or(page.getByText("필요 재료")).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("캐릭터 장비를 불러와 현재 단계를 채운다", async ({ page }) => {
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("재련");
    await page.getByRole("button", { name: "장비 불러오기" }).click();
    await expect(page.getByText(/재련 · 루페온 · 아이템 레벨 1,738\.33/)).toBeVisible();
    await expect(page.getByRole("group", { name: "무기" }).getByRole("combobox", { name: "현재" })).toHaveValue("21");
    // 업화·전율이 아닌 어깨는 계산에서 빠진다.
    await expect(page.getByText(/어깨 부위는 업화·전율 장비가 아니거나/)).toBeVisible();
  });
});

test.describe("재료 구매 견적 @smoke", () => {
  test("검색한 재료를 넣고 견적을 계산한다", async ({ page }) => {
    await page.goto("/tools/material-quote");
    const compute = page.getByRole("button", { name: "견적 계산" });
    await expect(compute).toBeDisabled();
    // 카테고리 목록이 도착하면 선택란이 활성화된다(도착 전 검색은 regression/material-quote-options).
    await expect(page.getByRole("combobox", { name: "카테고리" })).toBeEnabled();

    await page.getByRole("textbox", { name: "재료 이름" }).fill("합성");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await page.getByRole("button", { name: "합성 재련 재료 견적에 추가" }).click();
    await expect(page.getByRole("heading", { name: "재료 1/10" })).toBeVisible();

    await page.getByRole("textbox", { name: "필요", exact: true }).fill("250");
    await page.getByRole("textbox", { name: "보유", exact: true }).fill("30");
    await expect(compute).toBeEnabled();
    await compute.click();
    // 부족 220개 → 100개 묶음 3개(300개), 묶음당 12골드 = 36골드
    await expect(page.getByText(/36/).first()).toBeVisible();
    await expect(page.getByText(/합성 재련 재료/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("치적·뭉가·음돌 @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/crit-speed");
  });

  test("캐릭터를 계산하면 치명타·속도 출처를 보여 준다", async ({ page }) => {
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("상세");
    await page.getByRole("button", { name: "계산하기" }).click();
    await expect(page.getByText(/규칙 crit-speed-v\d+/)).toBeVisible();
    await expect(page.getByText("백어택 적중 가정")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("없는 캐릭터는 안내한다", async ({ page }) => {
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("미존재");
    await page.getByRole("button", { name: "계산하기" }).click();
    await expect(page.getByText("캐릭터를 찾지 못했어요")).toBeVisible();
  });
});

// 도구 목록(/tools)과 옛 돌파고 주소의 영구 이동(방향 전환 2026-10-10 §6).
test.describe("도구 목록 @smoke", () => {
  test("도구 카드로 각 화면에 간다", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.getByRole("heading", { level: 1, name: "도구 모음" })).toBeVisible();
    await expect(page.getByRole("link", { name: /재련 기대 비용/ })).toHaveAttribute("href", "/tools/refining");
    await expect(page.getByRole("link", { name: /돌파고/ })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("옛 돌파고 주소는 도구 목록으로 영구 이동한다", async ({ page }) => {
    const response = await page.request.get("/tools/stone?m=1s", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toMatch(/\/tools$/);
  });
});
