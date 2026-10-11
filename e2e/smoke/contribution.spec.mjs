// 기여도 계산기(/tools/contribution, 체크리스트 L41). 관문별 하한·상한은 계산 검증 표본
// (lib/tools/data/raid-contribution.json), 화면에는 기준 시점만.
import { test, expect, gotoReady, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";

test.describe("기여도 계산기 @smoke", () => {
  test("관문을 골라 피해량을 넣으면 하한~상한 사이 위치를 보여 준다", async ({ page }) => {
    await gotoReady(page, "/tools/contribution");
    await expect(page.getByRole("heading", { level: 1, name: "기여도 계산기" })).toBeVisible();
    await chooseOption(page, page.getByRole("combobox", { name: "레이드" }), "세르카");
    await chooseOption(page, page.getByRole("combobox", { name: "난이도" }), "하드");
    const result = page.getByRole("region", { name: "세르카 하드 1관문" });
    await expect(result).toContainText("2,300억");
    await expect(result).toContainText("3,070억");
    await expect(result).toContainText("기준 시점 2026-03-27");
    const damage = page.getByRole("textbox", { name: "내 피해량(억)" });
    // 계산 검증 표본: 2,555.6억 → 33.2%, 2,200억 → −13%(하한 아래), 3,200억 → 116.9%(상한 위)
    await damage.fill("2,555.6");
    await expect(page.getByRole("status")).toContainText("내 위치 33.2% · 범위 안이에요");
    await damage.fill("2200");
    await expect(page.getByRole("status")).toContainText("-13% · 하한 아래예요");
    await damage.fill("3200");
    await expect(page.getByRole("status")).toContainText("116.9% · 상한 위예요");
    await damage.fill("abc");
    await expect(page.getByText("숫자만 입력해 주세요(억 단위).")).toBeVisible();
    await expect(page.getByText(/출처|인벤/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("기준값을 확인 중인 관문은 숫자 없이 '데이터 없음'이다", async ({ page }) => {
    // 계산 검증 10-12: HOLD 6관문은 추정값을 쓰지 않는다.
    await gotoReady(page, "/tools/contribution");
    await chooseOption(page, page.getByRole("combobox", { name: "레이드" }), "4막");
    await chooseOption(page, page.getByRole("combobox", { name: "난이도" }), "하드");
    const result = page.getByRole("region", { name: "4막 하드 1관문" });
    await expect(result).toContainText("데이터 없음");
    await page.getByRole("textbox", { name: "내 피해량(억)" }).fill("1800");
    await expect(page.getByRole("status")).toContainText("이 관문은 기준값을 확인하고 있어 아직 계산하지 않아요.");
  });
});
