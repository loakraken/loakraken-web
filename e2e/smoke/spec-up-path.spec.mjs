// 스펙업 추천 순서 (api #794): its own section under the spec-up list, asked
// for on a click. The mock serves the backend's sample (보석 8→9→10, 품질 unpriced)
// on the mock character; '스펙순서긴' has 14 steps, '스펙순서몰림' is SPEC_UP_BUSY.
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const section = (page) => page.getByRole("region", { name: "추천 순서" });
const rows = (page) => section(page).getByRole("list", { name: /^추천 순서, / }).getByRole("listitem");

test.describe("스펙업 추천 순서 @smoke", () => {
  test("보기를 누르면 순서가 나오고, 단계 비용은 그 단계에서 더 드는 골드(보석은 앞 단계 빼고)", async ({ page }) => {
    await page.goto(characterPath("스펙순서", "specup"));
    const asked = page.waitForRequest((r) => r.url().includes("/api/characters/spec-up/path?"));
    await section(page).getByRole("button", { name: "추천 순서 보기" }).click();
    expect(new URL((await asked).url()).searchParams.get("sort")).toBe("EFFICIENCY");
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(0)).toContainText("8레벨 → 9레벨");
    await expect(rows(page).nth(0)).toContainText("+60만G");
    // 9→10 costs 260만G from today's gem; this step adds 200만G on top of step 1.
    await expect(rows(page).nth(1)).toContainText("+200만G");
    await expect(rows(page).nth(1)).toContainText("누적 260만G");
    await expect(section(page)).toContainText("합계 260만G");
    // NO_CANDIDATE reads the backend's sentence.
    await expect(section(page)).toContainText("시세가 있는 항목 가운데 전투력이 오르는 것을 모두 골랐어요.");
    await expect(section(page).getByText("시세를 몰라 순서에서 뺀 항목 1개")).toBeVisible();
    await expect(section(page).getByRole("link", { name: "이 순서를 시뮬레이터에서 열기" })).toHaveAttribute("href", /tab=simulator/);
  });

  test("기준을 바꾸면 그 기준으로 다시 묻고, 새 답이 올 때까지 앞 순서가 남음(흔들림 0)", async ({ page }) => {
    await watchShifts(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(characterPath("스펙순서", "specup"));
    await section(page).getByRole("button", { name: "추천 순서 보기" }).click();
    await expect(rows(page)).toHaveCount(2);
    const asked = page.waitForRequest((r) => r.url().includes("sort=DELTA"));
    const shifts = await shiftsDuring(page, async () => {
      await section(page).getByRole("button", { name: "전투력 증가" }).click();
      await asked;
    });
    await expect(section(page).getByRole("button", { name: "전투력 증가" })).toHaveAttribute("aria-pressed", "true");
    await expect(section(page).getByRole("list", { name: "추천 순서, 전투력 증가 기준" })).toBeVisible();
    expect(shifts.all, shifts.moved).toBe(0);
  });

  test("10단계 넘게는 접어 두고 '모두 보기'로 펼침, 320·360에서 가로 넘침 없음", async ({ page }) => {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(characterPath("스펙순서긴", "specup"));
      await section(page).getByRole("button", { name: "추천 순서 보기" }).click();
      await expect(rows(page)).toHaveCount(10);
      await expect(section(page)).toContainText("앞에서부터 14단계까지 보여 드려요.");
      const more = section(page).getByRole("button", { name: "14단계 모두 보기" });
      await more.click();
      await expect(rows(page)).toHaveCount(14);
      await expect(section(page).getByRole("button", { name: "앞 10단계만 보기" })).toHaveAttribute("aria-expanded", "true");
      await expectNoHorizontalOverflow(page);
    }
  });

  test("계산 자리가 차면(SPEC_UP_BUSY) 안내와 남은 초, 그동안 다시 누를 수 없음", async ({ page }) => {
    await page.goto(characterPath("스펙순서몰림", "specup"));
    await section(page).getByRole("button", { name: "추천 순서 보기" }).click();
    await expect(section(page).getByRole("alert")).toContainText("요청이 몰려 지금은 계산하지 못했어요");
    const again = section(page).getByRole("button", { name: /뒤 다시 계산$/ });
    await expect(again).toHaveAttribute("aria-disabled", "true");
    await expect(section(page).getByRole("button", { name: "다시 계산" })).toBeVisible({ timeout: 10_000 });
  });

  test("서포터는 추천 순서 칸이 없음", async ({ page }) => {
    await page.goto(characterPath("상세서포터", "specup"));
    await expect(page.getByRole("table", { name: "스펙업 후보, 서포터 점수 순" })).toBeVisible();
    await expect(section(page)).toHaveCount(0);
  });
});
