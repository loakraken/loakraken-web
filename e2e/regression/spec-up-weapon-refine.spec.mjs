// 회귀(#1567, #1555 리뷰 P2-2): 시뮬레이터가 무기 재련을 바꿀 수 있게 된 뒤에도 스펙업 '적용해 보기'와
// 목표 경로가 무기 재련 단계를 빼고 넘겼다. 무기 재련은 넘긴다. 목: "스펙업무기재련"은 무기 +20(0번), 투구 +19(1번)이고,
// 무기·투구 재련 후보가 둘 다 OK로 온다. 방어구 재련은 ARMOR_CP_SIM(e2e에서 켜짐)일 때만 넘긴다: 켜진 여기서는 투구
// 줄도 열리고, 꺼진 화면(무기만)은 tests/armor-cp-sim.test.ts가 본다(PM 총괄 11-21).
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const NAME = "스펙업무기재련";
const simulateRequest = (page) =>
  page.waitForRequest((r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST");

async function expandAll(page) {
  const table = page.getByRole("table", { name: /스펙업 후보/ });
  await table.locator("tbody tr").first().waitFor();
  const more = table.getByRole("button", { name: /^자세히 · 다른 단계/ });
  for (let i = 0; i < 20 && (await more.count()) > 0; i += 1) await more.first().click();
  await expect(more).toHaveCount(0);
}

/** The simulator tab with the weapon at +21 and the helmet at `helmet`; no shift while the answer lands. */
async function expectWeaponAt21(page, mark, helmet = "19") {
  const tabs = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
  await expect(tabs.getByRole("link", { name: "시뮬레이터", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("combobox", { name: "무기 재련 단계" })).toHaveText("21");
  await expect(page.getByRole("combobox", { name: "투구 재련 단계" })).toHaveText(helmet);
  await expect(page.getByRole("region", { name: "바꾼 것" })).toContainText("20 → 21");
  await page.waitForTimeout(500);
  const { all, moved } = await shiftsSince(page, mark);
  expect(all, `흔들림 (${moved})`).toBe(0);
  await expectNoHorizontalOverflow(page);
}

// codex #1572 P3: the refine range comes with the simulator options. Until they arrive a refine edit is
// not sent (it could be outside the range and refused); it goes out with the range, once.
test("옵션이 늦게 와도 무기 재련 바꾸기는 옵션을 받은 뒤에 한 번 보낸다 @regression", async ({ page }) => {
  let optionsAt = 0;
  const simulateAt = [];
  await page.route("**/api/combat-power/options", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  // The options answer's headers (the earliest event for it), so ordering between events cannot make it late.
  page.on("response", (r) => {
    if (r.url().includes("/api/combat-power/options")) optionsAt = Date.now();
  });
  page.on("request", (r) => {
    if (r.url().includes("/api/combat-power/simulate")) simulateAt.push(Date.now());
  });
  await page.goto(`${characterPath(NAME, "specup")}&sort=DELTA`);
  await expandAll(page);
  const asked = simulateRequest(page);
  await page.getByRole("table", { name: /스펙업 후보/ }).getByRole("link", { name: "+20 테스트 무기 +21 시뮬레이터에서 적용해 보기" }).click();
  expect((await asked).postDataJSON().changes).toEqual([{ kind: "EQUIPMENT_REFINE", index: 0, refine: 21 }]);
  expect(optionsAt, "옵션 응답이 끝나기 전에 계산 요청이 나감").toBeGreaterThan(0);
  expect(simulateAt[0]).toBeGreaterThanOrEqual(optionsAt);
  await expect(page.getByRole("combobox", { name: "무기 재련 단계" })).toHaveText("21");
  await page.waitForTimeout(500);
  expect(simulateAt).toHaveLength(1);
});

for (const width of [320, 1280]) {
  test(`${width}: 무기 재련 '적용해 보기'는 무기 한 단계만 넣어 시뮬레이터를 연다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await page.goto(`${characterPath(NAME, "specup")}&sort=DELTA`);
    await expandAll(page);
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    // Both refine rows are listed; with ARMOR_CP_SIM (on in e2e) the helmet's opens the simulator too.
    await expect(table.locator("tbody tr").filter({ hasText: "+19 테스트 투구" })).toHaveCount(1);
    await expect(table.getByRole("link", { name: "+19 테스트 투구 +20 시뮬레이터에서 적용해 보기" })).toHaveCount(1);
    const asked = simulateRequest(page);
    await table.getByRole("link", { name: "+20 테스트 무기 +21 시뮬레이터에서 적용해 보기" }).click();
    const body = (await asked).postDataJSON();
    const mark = await shiftMark(page);
    expect(body).toEqual({ characterName: NAME, changes: [{ kind: "EQUIPMENT_REFINE", index: 0, refine: 21 }] });
    await expectWeaponAt21(page, mark);
  });

  test(`${width}: 목표 경로를 시뮬레이터에서 열면 무기 재련 단계와 (ARMOR_CP_SIM) 방어구 재련 단계가 들어간다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await page.goto(`${characterPath(NAME, "specup")}&sort=DELTA`);
    const goal = page.getByRole("region", { name: "목표 전투력" });
    // Past the weapon step (12,495.52), so the path ends on the helmet step (12,505.52).
    await goal.getByRole("textbox", { name: "목표 전투력" }).fill("12500");
    await goal.getByRole("button", { name: "경로 찾기" }).click();
    await expect(goal).not.toContainText("시뮬레이터에서 아직 바꿀 수 없어 빼고 열어요");
    const asked = simulateRequest(page);
    await goal.getByRole("link", { name: "이 경로를 시뮬레이터에서 열기" }).click();
    const body = (await asked).postDataJSON();
    const mark = await shiftMark(page);
    // Gems 8 → 10 (slot 1 in the mock), weapon quality 90 → 100, the weapon's refine and (ARMOR_CP_SIM) the helmet's.
    expect(body.changes.filter((change) => change.kind === "EQUIPMENT_REFINE")).toEqual([
      { kind: "EQUIPMENT_REFINE", index: 0, refine: 21 },
      { kind: "EQUIPMENT_REFINE", index: 1, refine: 20 },
    ]);
    expect(body.changes.map((change) => change.kind)).toEqual(["GEM_LEVEL", "EQUIPMENT_REFINE", "EQUIPMENT_QUALITY", "EQUIPMENT_REFINE"]);
    await expectWeaponAt21(page, mark, "20");
  });
}
