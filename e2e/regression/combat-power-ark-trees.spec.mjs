// 전투력 시뮬레이터 아크 패시브 진화 열기(api #965, PM 총괄 11-16). 최대값은 게임 안 값 140(근거는
// lib/combat-power/model.ts). 깨달음은 '준비 중'으로 남는다: api는 100 이하만 계산하고 거의 모든 캐릭터가 101이라
// (계산 검증 11-15), api가 100 초과를 계산하면 연다. 목 '전투력코어도약'은 진화 120·깨달음 95·도약 60.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const simulate = (r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST";
const passive = (page) => page.getByRole("region", { name: "아크 패시브", exact: true });
const field = (page, tree) => passive(page).getByRole("textbox", { name: `아크 패시브 ${tree} 포인트`, exact: true });
const row = (page, tree) => page.getByRole("region", { name: "바꾼 것" }).getByRole("listitem").filter({ hasText: `아크 패시브 ${tree}` });

for (const width of [320, 1280]) {
  test(`진화는 140까지 바꿔 보내고, 키로 150을 넣으면 140에 맞춘다; 깨달음은 '준비 중' (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력코어도약")}`);
    const evolution = field(page, "진화");
    await expect(evolution).toHaveValue("120");
    await expect(evolution).toHaveAccessibleDescription("최대 140");
    // 깨달음 stays locked: its value with '준비 중', no field.
    await expect(field(page, "깨달음")).toHaveCount(0);
    await expect(passive(page).getByRole("listitem").filter({ hasText: "깨달음" })).toContainText("포인트 95P · 준비 중");

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
}
