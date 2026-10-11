// 스펙업 가이드 탭(백엔드 #318, PM-프론트 10-11 16:37 ⑤). 목 서버는 백엔드 표본을 그대로 준다:
// OK 3개(보석 8→9 62만G·8→10 262만G, 무기 품질 비용 미확인) + 계산 못 한 후보는 이유별 한 줄.
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const NAME = "전투력계산";

test.describe("스펙업 가이드 @smoke", () => {
  test("후보를 효율 순으로 보여 주고, 비용·근거·계산 못 한 후보를 나눠 보여 준다", async ({ page }) => {
    await page.goto(characterPath(NAME, "specup"));
    const tabs = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
    await expect(tabs.getByRole("link", { name: "스펙업", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("세팅 해설 기능은 준비 중이에요.")).toBeVisible();
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("62만G");
    await expect(rows.nth(0)).toContainText("+24.00");
    await expect(rows.nth(0)).toContainText("0.39");
    await expect(rows.nth(1)).toContainText("262만G");
    await expect(rows.nth(2)).toContainText("비용 미확인");
    await expect(page.getByText(/거래소 수수료 5%를 뺀 값/)).toBeVisible();
    const folded = page.getByRole("region", { name: "아직 계산하지 않은 후보" });
    await expect(folded).toContainText("재련");
    await expect(folded).toContainText("이 항목의 전투력 계산식을 아직 확인하고 있어");
    await expectNoHorizontalOverflow(page);
  });

  test("정렬을 바꾸면 전투력 증가 순으로 다시 받는다", async ({ page }) => {
    await page.goto(characterPath(NAME, "specup"));
    await page.getByRole("button", { name: "전투력 증가" }).click();
    await expect(page.getByRole("button", { name: "전투력 증가" })).toHaveAttribute("aria-pressed", "true");
    // 표본 Δ: 품질 90.33 > 보석 10레벨 48.07 > 9레벨 24
    await expect(page.getByRole("table", { name: /전투력 증가 순/ }).locator("tbody tr").first()).toContainText("+90.33");
  });

  test("적용해 보기는 시뮬레이터 탭에 그 변화를 넣고, 이전으로 되돌린다", async ({ page }) => {
    await page.goto(characterPath(NAME, "specup"));
    await page.getByRole("link", { name: /10레벨 시뮬레이터에서 적용해 보기/ }).click();
    const tabs = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
    await expect(tabs.getByRole("link", { name: "시뮬레이터", exact: true })).toHaveAttribute("aria-current", "page");
    const gem = page.getByRole("combobox", { name: "테스트 보석 레벨" });
    await expect(gem).toHaveText("10");
    await page.getByRole("button", { name: "이전" }).click();
    await expect(gem).not.toHaveText("10");
  });

  test("기능이 꺼져 있으면 그렇게 알리고, 요청을 되풀이하지 않는다", async ({ page }) => {
    let requests = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/characters/spec-up")) requests++;
    });
    await page.goto(characterPath("스펙업꺼짐", "specup"));
    await expect(page.getByText("스펙업 가이드는 아직 열리지 않았어요")).toBeVisible();
    await page.waitForTimeout(1000);
    // 오류 응답에 다시 요청하는 고리가 없어야 한다. 운영 빌드는 1번, 개발 서버는
    // React StrictMode가 처음 한 번을 두 번 보낼 수 있다.
    expect(requests).toBeLessThanOrEqual(2);
  });
});
