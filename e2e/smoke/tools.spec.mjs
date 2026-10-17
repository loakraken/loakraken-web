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
    // 결론 카드(맨 위)와 결과 영역이 같은 단계 수를 보여 준다(피아식별 심각 2).
    await expect(page.getByRole("region", { name: /목표까지 예상 비용/ }).getByText(/총 12단계/)).toBeVisible();
    await expect(page.getByRole("region", { name: "예상 소모" }).getByText(/총 12단계/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "필요 재료" }).or(page.getByText("필요 재료")).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("책 효과는 기본으로 넣고, 끄면 값과 가정 문장이 바뀐다", async ({ page }) => {
    // PM 총괄 10-11 00:20 결정 ②: 책 기본 포함.
    const weaponBook = page.getByRole("switch", { name: /무기 책 효과 적용/ });
    const armorBook = page.getByRole("switch", { name: /방어구 책 효과 적용/ });
    await expect(weaponBook).toBeChecked();
    await expect(armorBook).toBeChecked();
    await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
    const result = page.getByRole("region", { name: "예상 소모" });
    await expect(result.getByText(/책\(야금술·재봉술\) 효과가 매번 적용된다고 가정했어요/)).toBeVisible();
    const total = page.getByRole("region", { name: /목표까지 예상 비용/ }).locator("[class*=topTotal]");
    await expect(total).toBeVisible();
    const withBooks = await total.innerText();
    // The switch covers its whole row (A36), so it is pressed as the switch.
    await page.getByRole("switch", { name: /^무기 책 효과 적용/ }).click();
    await page.getByRole("switch", { name: /^방어구 책 효과 적용/ }).click();
    await expect(total).not.toHaveText(withBooks);
    await expect(result.getByText(/효과가 매번 적용된다고 가정했어요/)).toHaveCount(0);
  });

  test("캐릭터 장비를 불러와 현재 단계를 채운다", async ({ page }) => {
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("재련");
    await page.getByRole("button", { name: "장비 불러오기" }).click();
    await expect(page.getByText(/재련 · 루페온 · 아이템 레벨 1,738\.33/)).toBeVisible();
    await expect(page.getByRole("group", { name: "무기" }).getByRole("combobox", { name: "현재" })).toHaveText("+21");
    // 업화·전율이 아닌 어깨는 계산에서 빠진다.
    await expect(page.getByText(/어깨 부위는 업화·전율 장비가 아니거나/)).toBeVisible();
  });
});

test.describe("재료 구매 견적 @smoke", () => {
  test("카테고리는 묶음 알약 탭과 분류 칩이고, 고른 분류는 주소로 남는다", async ({ page }) => {
    // 사용자 10-11 00:04: 기본 드롭다운 대신 공통 알약 탭(web #417).
    await page.goto("/tools/material-quote");
    const tabs = page.getByRole("tablist", { name: "카테고리" });
    await expect(tabs).toBeVisible();
    const selected = tabs.getByRole("tab", { selected: true });
    await expect(selected).toHaveCount(1);
    const group = await selected.innerText();
    const chips = page.getByRole("group", { name: `${group} 분류` });
    await expect(chips.getByRole("button", { name: "전체", pressed: true })).toBeVisible();
    const kindName = await chips.getByRole("button", { pressed: false }).first().innerText();
    const kind = chips.getByRole("button", { name: kindName });
    await kind.click();
    await expect(kind).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/[?&]category=\d+/);
    await page.reload();
    await expect(page.getByRole("group", { name: `${group} 분류` }).getByRole("button", { name: kindName })).toHaveAttribute("aria-pressed", "true");
    // 키보드: 화살표로 다음 묶음.
    await page.getByRole("tablist", { name: "카테고리" }).getByRole("tab", { selected: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tablist", { name: "카테고리" }).getByRole("tab", { selected: true })).not.toHaveText(group);
  });

  test("검색한 재료를 넣고 견적을 계산한다", async ({ page }) => {
    await page.goto("/tools/material-quote");
    const compute = page.getByRole("button", { name: "견적 계산" });
    await expect(compute).toBeDisabled();
    // 카테고리 목록이 도착하면 묶음 탭이 나온다(도착 전 검색은 regression/material-quote-options).
    await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();

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
    // The parts and their sum, written out (PM-프론트 P2, crit-speed v7).
    await expect(page.getByText(/캐릭터 [\d.]+% \+ 가정 [\d.]+% = 합계 [\d.]+%/)).toBeVisible();
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
