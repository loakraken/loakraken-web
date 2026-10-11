// 전투력 시뮬레이터(/tools/combat-power, 백엔드 #240 계약 A단계).
// 목 서버: 보통 캐릭터는 모든 항목이 UNSUPPORTED(계산 준비 중),
// "전투력계산"은 합성 OK 값(게임 식 아님)으로 계산된 경로를 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";

test.describe("전투력 시뮬레이터 @smoke", () => {
  test("계산식 확인 전 항목은 숫자 없이 '계산 준비 중'으로 보여 준다", async ({ page }) => {
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("언새늘")}`);
    await expect(page.getByRole("heading", { level: 1, name: "전투력 시뮬레이터" })).toBeVisible();
    await chooseOption(page, page.getByRole("combobox", { name: "테스트 보석 레벨" }), "10");
    await expect(page.getByText("계산 준비 중")).toBeVisible();
    await expect(page.getByText(/바꾼 1개 항목은 계산식을 확인하고 있어/)).toBeVisible();
    await expect(page.getByText("12,345.67")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("계산된 항목은 증가분과 함께 반영하고, 초기화로 되돌린다", async ({ page }) => {
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`);
    await chooseOption(page, page.getByRole("combobox", { name: "투구 품질" }), "100");
    const changes = page.getByRole("region", { name: "바꾼 것" });
    await expect(changes.getByText("+10.00")).toBeVisible();
    await expect(page.getByText("12,355.67")).toBeVisible();
    await page.getByRole("button", { name: "초기화" }).click();
    await expect(page.getByText("아래에서 값을 바꾸면 바로 다시 계산해요.")).toBeVisible();
  });

  test("이전·다음으로 입력을 오가고, 저장한 입력은 새로고침 뒤 불러온다", async ({ page }) => {
    // PM-프론트 10-11 16:37 ②·L6: 버튼 없이 자동 계산, 이전/다음/초기화, 브라우저 저장.
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`);
    const band = page.getByRole("region", { name: /전투력$/ });
    await expect(band).toContainText("아이템 레벨 1,700.5");
    const quality = page.getByRole("combobox", { name: "투구 품질" });
    const before = await quality.inputValue();
    await quality.selectOption("100");
    await expect(page.getByText("12,355.67")).toBeVisible();
    await expect(band).toContainText("예상 전투력");

    await page.getByRole("button", { name: "이전" }).click();
    await expect(quality).toHaveValue(before);
    await expect(page.getByText("아래에서 값을 바꾸면 바로 다시 계산해요.")).toBeVisible();
    await page.getByRole("button", { name: "다음" }).click();
    await expect(quality).toHaveValue("100");
    await expect(page.getByText("12,355.67")).toBeVisible();

    await page.getByRole("button", { name: "입력 저장" }).click();
    await expect(page.getByRole("status").filter({ hasText: "입력을 저장했어요" })).toBeVisible();
    await page.reload();
    await expect(quality).toHaveValue(before);
    await page.getByRole("button", { name: "저장한 입력 불러오기" }).click();
    await expect(quality).toHaveValue("100");
    await expect(page.getByText("12,355.67")).toBeVisible();
    // 불러오기도 한 단계라 이전으로 돌아간다.
    await page.getByRole("button", { name: "이전" }).click();
    await expect(quality).toHaveValue(before);
  });

  test("보석 레벨 0은 '빼기'로 고르고 '빼기'로 읽는다(백엔드 #250)", async ({ page }) => {
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`);
    const gem = page.getByRole("combobox", { name: "테스트 보석 레벨" });
    await gem.click();
    await expect(page.getByRole("option").first()).toHaveText("빼기");
    await page.getByRole("option", { name: "빼기", exact: true }).click();
    await expect(page.getByRole("region", { name: "바꾼 것" }).getByText("9 → 빼기")).toBeVisible();
    await page.getByRole("combobox", { name: "보석 모두 같은 레벨로" }).click();
    await expect(page.getByRole("option", { name: "모두 빼기", exact: true })).toHaveCount(1);
    await page.keyboard.press("Escape");
  });

  test("1차판: 각인·스톤은 바꾸고, 재련·연마·팔찌·아크 패시브·코어는 '준비 중'으로 잠긴다", async ({ page }) => {
    // PM 총괄 23:59: 목표 사이트 대조가 맞은 항목(보석·품질·각인·스톤)만 바꿀 수 있다.
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`);
    await chooseOption(page, page.getByRole("combobox", { name: "스톤 원한 레벨" }), "2");
    await chooseOption(page, page.getByRole("combobox", { name: "패시브 각인 각인 레벨" }), "3");
    const changes = page.getByRole("region", { name: "바꾼 것" });
    await expect(changes.getByText("스톤 원한")).toBeVisible();
    await expect(changes.getByText("4 → 3")).toBeVisible();
    for (const name of ["투구 재련 단계", "투구 상급 재련 단계", "테스트 목걸이 추가 피해 등급", "팔찌 치명타 피해 등급", "테스트 코어 등급"])
      await expect(page.getByRole("combobox", { name })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "아크 패시브 진화 포인트" })).toHaveCount(0);
    for (const title of ["연마", "팔찌", "아크 패시브", "아크 그리드 코어"])
      await expect(page.getByRole("region", { name: title, exact: true })).toContainText("준비 중");
    await expect(page.getByText("재련 +19 · 준비 중")).toBeVisible();
    // 잠긴 연마 줄도 등급과 공식 수치를 같은 단위로(backend #254): "중(+1.60%)".
    await expect(page.getByRole("region", { name: "연마", exact: true }).getByText("등급 중(+1.60%) · 준비 중")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("캐릭터 화면 시뮬레이터 탭에서도 같은 계산을 하고, 도구 화면으로 이어진다", async ({ page }) => {
    // PM-프론트 10-11 ①: 캐릭터 탭으로 연결, 도구 경로는 그대로.
    await gotoReady(page, `/character/${encodeURIComponent("전투력계산")}?tab=simulator`);
    const tabs = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
    await expect(tabs.getByRole("link", { name: "시뮬레이터", exact: true })).toHaveAttribute("aria-current", "page");
    await chooseOption(page, page.getByRole("combobox", { name: "투구 품질" }), "100");
    await expect(page.getByRole("region", { name: "바꾼 것" }).getByText("+10.00")).toBeVisible();
    await expect(page.getByText("12,355.67")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: "도구 화면으로" }).click();
    await expect(page).toHaveURL(/\/tools\/combat-power\?character=/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "전투력 시뮬레이터" })).toBeVisible();
  });
});
