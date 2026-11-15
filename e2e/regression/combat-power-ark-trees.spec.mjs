// 전투력 시뮬레이터 아크 패시브 진화·깨달음 열기(api #965, PM 총괄 11-16). 최대값은 게임 안 값(진화 140, 깨달음 101;
// 근거는 lib/combat-power/model.ts). api는 깨달음이 지금이나 바꾼 값 어느 쪽이든 100을 넘으면 계산하지 않는다: 칸 옆에
// 그렇게 말하고, 바꾼 것 줄은 '계산 준비 중'과 api 문장이며 숫자를 보이지 않는다. 목 '전투력코어도약'은 진화 120·깨달음 95,
// '전투력깨달음101'은 깨달음 101(공식 캐릭터 28명 중 27명, 계산 검증 11-15). 웹은 계산하지 않고 api 값을 그대로 보인다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const simulate = (r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST";
const OVER = "최대 101 · 지금이나 바꾼 값이 100을 넘으면 계산식을 확인하고 있어 계산하지 않아요";
const open = (page, name) => gotoReady(page, `/tools/combat-power?character=${encodeURIComponent(name)}`);
const field = (page, tree) =>
  page.getByRole("region", { name: "아크 패시브", exact: true }).getByRole("textbox", { name: `아크 패시브 ${tree} 포인트`, exact: true });
const row = (page, tree) => page.getByRole("region", { name: "바꾼 것" }).getByRole("listitem").filter({ hasText: `아크 패시브 ${tree}` });

for (const width of [320, 1280]) {
  test(`진화는 140까지 바꿔 보내고, 키로 150을 넣으면 140에 맞춘다 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "전투력코어도약");
    const evolution = field(page, "진화");
    await expect(evolution).toHaveAccessibleDescription("최대 140");
    const asked = page.waitForRequest((r) => simulate(r) && r.postData()?.includes('"points":140'));
    await evolution.selectText();
    await evolution.pressSequentially("150");
    await expect(evolution).toHaveValue("140");
    await expect(evolution).toHaveAccessibleDescription("최대 140까지 넣을 수 있어 140에 맞췄어요");
    await evolution.press("Tab");
    expect((await asked).postDataJSON().changes).toEqual([{ kind: "ARK_PASSIVE_POINT", tree: "진화", points: 140 }]);
    await expect(row(page, "진화")).toContainText("120 → 140");
    await expect(row(page, "진화")).not.toContainText("계산 준비 중");
    await expectNoHorizontalOverflow(page);
  });

  test(`깨달음은 100까지 계산하고, 101이면 칸 옆에 말하며 숫자 없이 '계산 준비 중' (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "전투력코어도약");
    const enlightenment = field(page, "깨달음");
    await expect(enlightenment).toHaveAccessibleDescription("최대 101");

    // 100: computed (the api's own number comes back).
    const at100 = page.waitForRequest((r) => simulate(r) && r.postData()?.includes('"points":100'));
    await enlightenment.fill("100");
    await enlightenment.blur();
    await at100;
    await expect(row(page, "깨달음")).toContainText("95 → 100");
    await expect(row(page, "깨달음")).not.toContainText("계산 준비 중");

    // 101: sent (the in-game maximum), not computed; said by the field and the row, never a number.
    const at101 = page.waitForRequest((r) => simulate(r) && r.postData()?.includes('"points":101'));
    await enlightenment.fill("101");
    await enlightenment.blur();
    await at101;
    await expect(enlightenment).toHaveAccessibleDescription(OVER);
    await expect(page.getByText(OVER, { exact: true })).toBeVisible();
    await expect(row(page, "깨달음")).toContainText("계산 준비 중");
    await expect(row(page, "깨달음")).toContainText("깨달음 포인트 100 초과의 전투력 계산식을 아직 확인하고 있어 계산하지 않았습니다.");
    await expect(row(page, "깨달음")).not.toContainText(/[+-]\d/);
    await expectNoHorizontalOverflow(page);
  });
}

test("지금 깨달음이 101이면 처음부터 칸 옆에 말하고, 낮춰도 계산하지 않음(api와 같음)", async ({ page }) => {
  await open(page, "전투력깨달음101");
  const enlightenment = field(page, "깨달음");
  await expect(enlightenment).toHaveValue("101");
  await expect(enlightenment).toHaveAccessibleDescription(OVER);
  const at90 = page.waitForRequest((r) => simulate(r) && r.postData()?.includes('"points":90'));
  await enlightenment.fill("90");
  await enlightenment.blur();
  await at90;
  await expect(enlightenment).toHaveAccessibleDescription(OVER);
  await expect(row(page, "깨달음")).toContainText("101 → 90");
  await expect(row(page, "깨달음")).toContainText("계산 준비 중");
});
