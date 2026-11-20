// 회귀(PM 총괄 11-21, 계산 검증 04:36 PASS): 무기 상급 재련은 업화 무기만 연다. 업화 무기('무기상재업화', +16 업화 상급 21)는
// 칸이 있고 바꾸면 그 한 줄만 보내 전투력이 숫자로 온다. 업화가 아닌 무기('전투력계산'의 테스트 무기)는 칸이 없다.
// 프록시는 상급 재련을 순번으로 가를 수 없어 방어구 상급 재련도 지나가지만, api의 방어구 스위치가 꺼져 있으면(목:
// 문 이름이 아닌 캐릭터) 전투력 없이 돌아온다: 막는 것은 api다(PM-프론트 11-21).
import { test, expect, chooseOption, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const UPGRADE = "무기상재업화";
const tool = (name) => `/tools/combat-power?character=${encodeURIComponent(name)}`;

for (const width of [320, 1280]) {
  test(`${width}: 업화 무기는 상급 재련을 바꿔 그 한 줄만 보내고, 전투력이 숫자로 온다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, tool(UPGRADE));
    const field = page.getByRole("combobox", { name: "무기 상급 재련 단계" });
    await expect(field).toHaveText("21");
    const asked = page.waitForRequest((r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST");
    await chooseOption(page, field, "30");
    expect((await asked).postDataJSON()).toEqual({
      characterName: UPGRADE,
      changes: [{ kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: 30 }],
    });
    const mark = await shiftMark(page);
    const row = page.getByRole("region", { name: "바꾼 것" }).getByRole("listitem");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("21 → 30");
    await expect(row).toContainText(/[+−-]\d+\.\d\d/);
    await expect(row).not.toContainText("계산 준비 중");
    await page.waitForTimeout(400);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

  test(`${width}: 업화가 아닌 무기(에스더, 상급 10을 읽어도)는 상급 재련 칸이 없다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, tool("무기상재에스더"));
    await expect(page.getByRole("combobox", { name: "무기 재련 단계" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "무기 상급 재련 단계" })).toHaveCount(0);
    // Neither a field nor a locked '상급 10 · 준비 중': the row has no 상급 at all.
    await expect(page.getByRole("listitem").filter({ hasText: "+8 에스더 테스트 무기" }).first()).not.toContainText("상급");
    await expectNoHorizontalOverflow(page);
  });
}

test("방어구 상급 재련은 프록시를 지나도 api의 방어구 스위치가 꺼져 있으면 전투력 없이 돌아온다 @regression", async ({ page }) => {
  await gotoReady(page, tool("전투력계산"));
  // From the page, as the simulator sends it (the route takes same-origin requests only).
  const { status, json } = await page.evaluate(async () => {
    const res = await fetch("/api/combat-power/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterName: "전투력계산", changes: [{ kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, level: 11 }] }),
    });
    return { status: res.status, json: await res.json() };
  });
  expect(status, "프록시는 정확한 상급 재련을 받는다").toBe(200);
  const envelope = json.envelope ?? json;
  const [row] = envelope.data.contributions;
  expect(row).toMatchObject({ kind: "EQUIPMENT_ADVANCED_REFINE", status: "UNSUPPORTED", delta: null });
});
