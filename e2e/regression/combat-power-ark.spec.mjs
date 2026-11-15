// 전투력 시뮬레이터 아크 그리드 코어(api #838)·아크 패시브 도약(api #842) 열기(PM 총괄 11-15).
// 도약 입력의 상한은 게임 안 최대값 70(공식 가이드 '아크 패시브', 2026-06-24): 71은 보내지 않는다.
// 목 캐릭터 '전투력코어도약': 진화 120P와 도약 60P, 테스트 코어(유물 14P)와 api가 아직 계산하지 않는
// 혼돈의 별 코어 : 무기(유물 17P). 바꾼 값은 api에 그대로 보내고, 웹은 전투력을 계산하지 않는다.
import { test, expect, gotoReady, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";

const NAME = "전투력코어도약";
const simulate = (r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST";

for (const width of [320, 1280]) {
  test(`코어 등급·포인트와 도약 포인트(최대 70)를 바꿔 보내고, 진화·무기 코어는 '준비 중'으로 남는다 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent(NAME)}`);

    const cores = page.getByRole("region", { name: "아크 그리드 코어", exact: true });
    await expect(cores.getByRole("combobox", { name: "테스트 코어 등급", exact: true })).toBeVisible();
    await expect(cores.getByRole("combobox", { name: "테스트 코어 포인트", exact: true })).toBeVisible();
    // The api does not compute the 무기 core yet (WEAPON_CORE_REASON): its row stays locked, nothing to send.
    await expect(cores.getByRole("combobox", { name: /혼돈의 별 코어 : 무기/ })).toHaveCount(0);
    await expect(cores.getByRole("listitem").filter({ hasText: "혼돈의 별 코어 : 무기" })).toContainText("유물 17P · 준비 중");

    const passive = page.getByRole("region", { name: "아크 패시브", exact: true });
    const field = passive.getByRole("textbox", { name: "아크 패시브 도약 포인트", exact: true });
    await expect(field).toHaveValue("60");
    await expect(passive.getByRole("textbox", { name: "아크 패시브 진화 포인트" })).toHaveCount(0);
    await expect(passive.getByRole("listitem").filter({ hasText: "진화" })).toContainText("포인트 120P · 준비 중");
    // The card is open (one tree is), so no card-wide "준비 중" badge.
    await expect(passive.locator("header")).not.toContainText("준비 중");

    await chooseOption(page, cores.getByRole("combobox", { name: "테스트 코어 등급", exact: true }), "고대");
    const asked = page.waitForRequest((r) => simulate(r) && r.postData()?.includes('"point":20'));
    await chooseOption(page, cores.getByRole("combobox", { name: "테스트 코어 포인트", exact: true }), "20");
    expect((await asked).postDataJSON()).toEqual({
      characterName: NAME,
      changes: [{ kind: "ARK_GRID_CORE", slotIndex: 0, grade: "고대", point: 20 }],
    });

    // 70, the in-game maximum, goes out.
    const leap = page.waitForRequest((r) => simulate(r) && r.postData()?.includes("ARK_PASSIVE_POINT"));
    await field.fill("70");
    await field.blur();
    expect((await leap).postDataJSON()).toEqual({
      characterName: NAME,
      changes: [
        { kind: "ARK_PASSIVE_POINT", tree: "도약", points: 70 },
        { kind: "ARK_GRID_CORE", slotIndex: 0, grade: "고대", point: 20 },
      ],
    });
    const changes = page.getByRole("region", { name: "바꾼 것" });
    await expect(changes.getByText("유물 14P → 고대 20P")).toBeVisible();
    await expect(changes.getByText("60 → 70")).toBeVisible();

    // 71 cannot exist in game: never applied or sent, and the field goes back to 70 on blur.
    const sent = [];
    page.on("request", (r) => {
      if (simulate(r)) sent.push(r.postData() ?? "");
    });
    await field.fill("71");
    await field.blur();
    await expect(field).toHaveValue("70");
    await expect(changes.getByText("60 → 70")).toBeVisible();
    expect(sent.filter((body) => body.includes('"points":71'))).toEqual([]);
    await expectNoHorizontalOverflow(page);
  });
}
