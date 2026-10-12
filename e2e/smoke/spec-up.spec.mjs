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

  // PM-프론트 10-12 P1: every OK row, each kind — the simulator tab takes the
  // change, asks for a simulation, and 이전 takes it back.
  for (const [row, combo, value] of [
    [/테스트 스킬 · 8레벨 겁화 9레벨/, "테스트 보석 2 레벨", "9"],
    [/테스트 스킬 · 8레벨 겁화 10레벨/, "테스트 보석 2 레벨", "10"],
    [/테스트 무기 품질 100/, "무기 품질", "100"],
  ]) {
    test(`적용해 보기(${combo} → ${value})는 시뮬레이터 탭에서 계산하고, 이전으로 되돌린다`, async ({ page }) => {
      await page.goto(characterPath(NAME, "specup"));
      let simulations = 0;
      page.on("request", (r) => {
        if (r.url().includes("/api/combat-power/simulate")) simulations++;
      });
      await page.getByRole("link", { name: new RegExp(row.source + ".*시뮬레이터에서 적용해 보기") }).click();
      const tabs = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
      await expect(tabs.getByRole("link", { name: "시뮬레이터", exact: true })).toHaveAttribute("aria-current", "page");
      const box = page.getByRole("combobox", { name: combo });
      await expect(box).toHaveText(value);
      await expect(page.getByRole("region", { name: "예상 전투력" })).toBeVisible();
      await expect.poll(() => simulations).toBeGreaterThan(0);
      await page.getByRole("button", { name: "이전" }).click();
      await expect(box).not.toHaveText(value);
    });
  }

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

  test("목표 전투력을 넣으면 효율 순 경로를 시뮬레이터로 계산해 보여 준다(L31)", async ({ page }) => {
    await page.goto(characterPath(NAME, "specup"));
    const goal = page.getByRole("region", { name: "목표 전투력" });
    await expect(goal.getByText("지금 12,345.67")).toBeVisible();
    const input = goal.getByRole("textbox", { name: "목표 전투력" });
    // 경로에 넣는 후보: 보석 8→9(62만G) 하나 — 같은 칸 8→10은 빠지고, 품질은 비용 미확인.
    await input.fill("12,360");
    await goal.getByRole("button", { name: "경로 찾기" }).click();
    await expect(goal).toContainText("1단계면 전투력 12,369.67(목표 12,360.00) · 기대 비용 62만G");
    await expect(goal.getByRole("list", { name: "효율 순으로 고른 경로" }).getByRole("listitem")).toHaveCount(1);
    await input.fill("13000");
    await goal.getByRole("button", { name: "경로 찾기" }).click();
    await expect(goal).toContainText("고를 수 있는 1단계를 모두 해도 전투력 12,369.67, 목표까지 630.33 남아요");
    await input.fill("12000");
    await goal.getByRole("button", { name: "경로 찾기" }).click();
    await expect(goal).toContainText("이미 목표 전투력(12,000.00) 이상이에요.");
    await input.fill("abc");
    await expect(goal.getByText("숫자만 입력해 주세요(소수 둘째 자리까지).")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
