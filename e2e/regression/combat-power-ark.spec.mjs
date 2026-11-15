// 전투력 시뮬레이터 아크 그리드 코어 열기(api #838, PM 총괄 11-15). 아크 패시브는 잠긴 채로: 도약은 api가 계산하지만
// 입력 상한(게임 안 최대값, 공식 출처)이 정해질 때까지 '준비 중'(PM 총괄 11-15 C안), 진화·깨달음은 api가 아직 계산하지 않음.
// 목 캐릭터 '전투력코어도약': 진화 120P와 도약 60P, 테스트 코어(유물 14P)와 api가 아직 계산하지 않는
// 혼돈의 별 코어 : 무기(유물 17P). 바꾼 값은 api에 그대로 보내고, 웹은 전투력을 계산하지 않는다.
import { test, expect, gotoReady, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";

const NAME = "전투력코어도약";

for (const width of [320, 1280]) {
  test(`코어 등급·포인트를 바꿔 보내고, 아크 패시브·무기 코어는 '준비 중'으로 남는다 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent(NAME)}`);

    const cores = page.getByRole("region", { name: "아크 그리드 코어", exact: true });
    await expect(cores.getByRole("combobox", { name: "테스트 코어 등급", exact: true })).toBeVisible();
    await expect(cores.getByRole("combobox", { name: "테스트 코어 포인트", exact: true })).toBeVisible();
    // The api does not compute the 무기 core yet (WEAPON_CORE_REASON): its row stays locked, nothing to send.
    await expect(cores.getByRole("combobox", { name: /혼돈의 별 코어 : 무기/ })).toHaveCount(0);
    await expect(cores.getByRole("listitem").filter({ hasText: "혼돈의 별 코어 : 무기" })).toContainText("유물 17P · 준비 중");
    // One row open: no card-wide "준비 중" badge on the core card.
    await expect(cores.locator("header")).not.toContainText("준비 중");

    const passive = page.getByRole("region", { name: "아크 패시브", exact: true });
    await expect(passive.getByRole("textbox")).toHaveCount(0);
    await expect(passive.getByRole("listitem").filter({ hasText: "도약" })).toContainText("포인트 60P · 준비 중");
    await expect(passive.getByRole("listitem").filter({ hasText: "진화" })).toContainText("포인트 120P · 준비 중");
    await expect(passive.locator("header")).toContainText("준비 중");

    await chooseOption(page, cores.getByRole("combobox", { name: "테스트 코어 등급", exact: true }), "고대");
    const asked = page.waitForRequest(
      (r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST" && r.postData()?.includes('"point":20'),
    );
    await chooseOption(page, cores.getByRole("combobox", { name: "테스트 코어 포인트", exact: true }), "20");
    expect((await asked).postDataJSON()).toEqual({
      characterName: NAME,
      changes: [{ kind: "ARK_GRID_CORE", slotIndex: 0, grade: "고대", point: 20 }],
    });

    // The api's answer, as given: the row with its from → to.
    await expect(page.getByRole("region", { name: "바꾼 것" }).getByText("유물 14P → 고대 20P")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
