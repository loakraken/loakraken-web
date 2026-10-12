// 전투력 시뮬레이터(/tools/combat-power, 백엔드 #240 계약 A단계).
// 목 서버: 보통 캐릭터는 모든 항목이 UNSUPPORTED(계산 준비 중),
// "전투력계산"은 합성 OK 값(게임 식 아님)으로 계산된 경로를 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";

test.describe("전투력 시뮬레이터 @smoke", () => {
  test("계산식 확인 전 항목은 숫자 없이 '계산 준비 중'으로 보여 준다", async ({ page }) => {
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("기준캐릭터A")}`);
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
    const before = (await quality.textContent()).trim();
    await chooseOption(page, quality, "100");
    await expect(page.getByText("12,355.67")).toBeVisible();
    await expect(band).toContainText("예상 전투력");

    await page.getByRole("button", { name: "이전" }).click();
    await expect(quality).toHaveText(before);
    await expect(page.getByText("아래에서 값을 바꾸면 바로 다시 계산해요.")).toBeVisible();
    await page.getByRole("button", { name: "다음" }).click();
    await expect(quality).toHaveText("100");
    await expect(page.getByText("12,355.67")).toBeVisible();

    await page.getByRole("button", { name: "입력 저장" }).click();
    await expect(page.getByRole("status").filter({ hasText: "입력을 저장했어요" })).toBeVisible();
    await page.reload();
    await expect(quality).toHaveText(before);
    await page.getByRole("button", { name: "저장한 입력 불러오기" }).click();
    await expect(quality).toHaveText("100");
    await expect(page.getByText("12,355.67")).toBeVisible();
    // 불러오기도 한 단계라 이전으로 돌아간다.
    await page.getByRole("button", { name: "이전" }).click();
    await expect(quality).toHaveText(before);
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

  test("각인·스톤·팔찌·팔 보호구는 바꾸고, 재련·연마·아크 패시브·코어는 '준비 중'으로 잠긴다", async ({ page }) => {
    // PM 총괄 23:59: 계산 검증을 통과한 항목(보석·품질·각인·스톤)만 바꿀 수 있다.
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`);
    await chooseOption(page, page.getByRole("combobox", { name: "스톤 원한 레벨" }), "2");
    await chooseOption(page, page.getByRole("combobox", { name: "패시브 각인 각인 레벨" }), "3");
    const changes = page.getByRole("region", { name: "바꾼 것" });
    await expect(changes.getByText("스톤 원한")).toBeVisible();
    await expect(changes.getByText("4 → 3")).toBeVisible();
    for (const name of ["투구 재련 단계", "투구 상급 재련 단계", "테스트 목걸이 추가 피해 등급", "테스트 코어 등급"])
      await expect(page.getByRole("combobox", { name })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "아크 패시브 진화 포인트" })).toHaveCount(0);
    for (const title of ["연마", "아크 패시브", "아크 그리드 코어"])
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

  test("전투력이 그대로인 변경은 그 이유를 바로 보여 준다(방어구 품질, L23)", async ({ page }) => {
    // 사용자 지적 10-12: 머리장식(방어구) 품질 95→100이 ±0.00만 보였다.
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`);
    await expect(page.getByText("방어구 품질은 생명 활성력(체력)만 올려 딜러 전투력은 그대로예요.", { exact: false })).toBeVisible();
    await chooseOption(page, page.getByRole("combobox", { name: "장갑 품질" }), "100");
    const changes = page.getByRole("region", { name: "바꾼 것" });
    await expect(changes.getByText("±0.00")).toBeVisible();
    await expect(changes.getByText("방어구 품질은 체력에만 붙어 전투력이 바뀌지 않습니다.")).toBeVisible();
    await expect(page.getByText("바꾼 항목은 전투력에 영향이 없어요.", { exact: false })).toBeVisible();
  });

  test("넓은 화면에서는 결과·버튼·바꾼 것이 한 묶음으로 따라온다", async ({ page }, info) => {
    // 사용자 지적 10-12: 예상 전투력 칸만 따라오던 것.
    test.skip((info.project.use.viewport?.width ?? 0) <= 900, "한 칸 화면은 결과 띠만 아래에 고정");
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`);
    await chooseOption(page, page.getByRole("combobox", { name: "투구 품질" }), "100");
    await expect(page.getByRole("region", { name: "바꾼 것" })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const inView = async (locator) => {
      const box = await locator.boundingBox();
      const height = page.viewportSize().height;
      return !!box && box.y >= 0 && box.y + box.height <= height;
    };
    expect(await inView(page.getByRole("region", { name: /전투력$/ }))).toBe(true);
    expect(await inView(page.getByRole("button", { name: "초기화" }))).toBe(true);
    expect(await inView(page.getByRole("heading", { name: "바꾼 것" }))).toBe(true);
  });

  test("예전 방식으로 저장한 입력은 장비를 확인할 수 없어 불러오지 않고 다시 저장을 안내한다", async ({ page }) => {
    // PM 총괄 10-12 01:54: 장비 순번만 남은 저장값은 다른 장비에 붙을 수 있다.
    const name = "전투력계산";
    await page.addInitScript((key) => {
      localStorage.setItem(key, JSON.stringify({ edits: { gemAll: null, gems: {}, refine: {}, quality: { 1: 100 }, advanced: {}, polish: {}, bracelet: {}, engraving: {}, stone: {}, arkPassive: {}, core: {} }, savedAt: "2026-10-11T10:00:00.000Z" }));
    }, `loakraken:combat-power:saved:${name}`);
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent(name)}`);
    await page.getByRole("button", { name: "저장한 입력 불러오기" }).click();
    await expect(page.getByRole("status").filter({ hasText: "다시 저장해 주세요" })).toBeVisible();
    await expect(page.getByText("아래에서 값을 바꾸면 바로 다시 계산해요.")).toBeVisible();
  });

  test("팔 보호구 단계·등급과 팔찌 계열을 바꿔 계산한다(백엔드 #342·#332)", async ({ page }) => {
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`);
    const guard = page.getByRole("region", { name: "팔 보호구" });
    await expect(guard).toContainText("+13 전율 완갑");
    await chooseOption(page, page.getByRole("combobox", { name: "팔 보호구 단계" }), "15");
    const changes = page.getByRole("region", { name: "바꾼 것" });
    await expect(changes.getByText("팔 보호구")).toBeVisible();
    await expect(changes.getByText("+13 유물 → +15 유물")).toBeVisible();
    await chooseOption(page, page.getByRole("combobox", { name: "팔찌 2번째 효과 계열" }), "추가 피해");
    await expect(changes.getByText("팔찌", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("서포터는 '계산하지 않음' 이유를 줄마다 반복하지 않고 결과 위에 한 번만 말한다(백엔드 #332)", async ({ page }) => {
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("상세서포터")}`);
    // Any change: the first gem one step down.
    const gem = page.getByRole("combobox", { name: / 레벨$/ }).first();
    await gem.click();
    await page.getByRole("option").first().click();
    const note = page.getByText("서포터 전투력 계산식은 아직 적용하지 않았습니다.");
    await expect(note).toHaveCount(1);
    await expect(note).toBeVisible();
  });

  test("전율 장비는 '상급 0 · 준비 중' 대신 상급 재련이 없다고만 말한다(PM-프론트 P1, A21)", async ({ page }) => {
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`);
    const row = page.getByRole("listitem").filter({ hasText: "+20 전율의 상의" });
    await expect(row).toContainText("상급 재련 없음");
    await expect(row).not.toContainText("상급 0");
    await expect(page.getByRole("combobox", { name: "상의 상급 재련 단계" })).toHaveCount(0);
    // 상급이 있는 장비는 그대로 '준비 중'.
    await expect(page.getByRole("listitem").filter({ hasText: "+19 테스트 투구" })).toContainText("상급 10 · 준비 중");
  });
});
