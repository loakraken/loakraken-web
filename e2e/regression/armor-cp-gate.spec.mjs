// 회귀(PM 총괄 11-21, api PR3): 방어구 전투력 문(spec-up.armor-cp-gate.enabled + web ARMOR_CP_SIM, e2e에서 켜짐)을
// 켜도 안전한지. 문 안 딜러('방어구문열림')는 방어구 재련 · 상급 재련 칸이 열려 바꾼 만큼 그대로 보내고, 전투력이 숫자로
// 온다(남은 '—'나 '준비 중' 없음). 스펙업 목록의 방어구 줄은 Δ전투력과 '적용해 보기'가 있고, 경로는 방어구 단계를
// 시뮬레이터로 넘긴다. 문 밖 딜러('방어구문닫힘')는 방어구 줄이 ARMOR_CP_RESIDUAL_HIGH로 와서 그 자리에 '계산하지 않음'과
// api 문장이, 목록은 접힌 줄 하나에 그 문장이 나온다. 320 · 1280, 흔들림 0, 가로 넘침 없음.
import { test, expect, chooseOption, characterPath, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const OPEN = "방어구문열림";
const CLOSED = "방어구문닫힘";
const TEXT = "장비로 계산한 전투력이 공식 전투력과 맞지 않아 방어구 재련 · 상급 재련 · 완갑 전투력은 계산하지 않았어요.";
const HELD_POINTER = "그 후보는 목록 아래 '아직 계산하지 않은 후보'에 있어요.";
const simulateRequest = (page) =>
  page.waitForRequest((r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST");
const tool = (name) => `/tools/combat-power?character=${encodeURIComponent(name)}`;

async function expandAll(page) {
  const table = page.getByRole("table", { name: /스펙업 후보/ });
  await table.locator("tbody tr").first().waitFor();
  const more = table.getByRole("button", { name: /^자세히 · 다른 단계/ });
  for (let i = 0; i < 20 && (await more.count()) > 0; i += 1) await more.first().click();
  await expect(more).toHaveCount(0);
}

for (const width of [320, 1280]) {
  test(`${width}: 문 안 — 방어구 재련 · 상급 재련을 바꾸면 그대로 보내고 전투력이 숫자로 온다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, tool(OPEN));
    const refine = page.getByRole("combobox", { name: "투구 재련 단계" });
    await expect(refine).toHaveText("19");
    let asked = simulateRequest(page);
    await chooseOption(page, refine, "20");
    expect((await asked).postDataJSON()).toEqual({ characterName: OPEN, changes: [{ kind: "EQUIPMENT_REFINE", index: 1, refine: 20 }] });
    asked = simulateRequest(page);
    await chooseOption(page, page.getByRole("combobox", { name: "투구 상급 재련 단계" }), "11");
    expect((await asked).postDataJSON()).toEqual({
      characterName: OPEN,
      changes: [
        { kind: "EQUIPMENT_REFINE", index: 1, refine: 20 },
        { kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, level: 11 },
      ],
    });
    const changes = page.getByRole("region", { name: "바꾼 것" });
    await expect(changes.getByRole("listitem")).toHaveCount(2);
    const mark = await shiftMark(page);
    for (const row of await changes.getByRole("listitem").all()) {
      await expect(row).toContainText(/[+−-]\d+\.\d\d/);
      await expect(row).not.toContainText("계산 준비 중");
      await expect(row).not.toContainText("계산하지 않음");
    }
    // The 전율 상의 still has no 상급 재련; the weapon's stays as before.
    await expect(page.getByRole("combobox", { name: "상의 상급 재련 단계" })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "무기 상급 재련 단계" })).toHaveCount(0);
    await page.waitForTimeout(400);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

  test(`${width}: 문 밖 — 방어구 줄은 숫자 대신 '계산하지 않음'과 api 문장, 나머지는 계산 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, tool(CLOSED));
    const asked = simulateRequest(page);
    await chooseOption(page, page.getByRole("combobox", { name: "투구 재련 단계" }), "20");
    expect((await asked).postDataJSON().changes).toEqual([{ kind: "EQUIPMENT_REFINE", index: 1, refine: 20 }]);
    const changes = page.getByRole("region", { name: "바꾼 것" });
    const row = changes.getByRole("listitem").filter({ hasText: "투구" });
    await expect(row).toContainText("계산하지 않음");
    await expect(row).toContainText(TEXT);
    await expect(row).not.toContainText("계산 준비 중");
    // A non-armour change on the same character is still computed.
    await chooseOption(page, page.getByRole("combobox", { name: "무기 재련 단계" }), "21");
    await expect(changes.getByRole("listitem").filter({ hasText: "무기" })).toContainText(/[+−-]\d+\.\d\d/);
    await expect(changes.getByText(TEXT)).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });

  test(`${width}: 문 안 — 스펙업 목록의 방어구 줄은 Δ전투력과 '적용해 보기'가 있고, 상급 재련도 시뮬레이터로 연다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await page.goto(`${characterPath(OPEN, "specup")}&sort=DELTA`);
    await expandAll(page);
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    const rows = table.locator("tbody tr").filter({ hasText: "+19 테스트 투구" });
    await expect(rows).toHaveCount(2);
    for (const step of ["+20", "상급 재련 11단계"]) {
      const row = rows.filter({ hasText: step });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(/\+\d+\.\d\d/);
      // Named as 상급 재련, not '기타' (the list's EQUIPMENT_ADVANCED_REFINE kind).
      await expect(row).not.toContainText("기타");
    }
    await expect(page.getByText(TEXT)).toHaveCount(0);
    const asked = simulateRequest(page);
    await table.getByRole("link", { name: "+19 테스트 투구 상급 재련 11단계 시뮬레이터에서 적용해 보기" }).click();
    const body = (await asked).postDataJSON();
    const mark = await shiftMark(page);
    expect(body).toEqual({ characterName: OPEN, changes: [{ kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, level: 11 }] });
    await expect(page.getByRole("combobox", { name: "투구 상급 재련 단계" })).toHaveText("11");
    await page.waitForTimeout(400);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

  test(`${width}: 문 밖 — 스펙업 목록은 방어구 줄을 접힌 줄 하나에 api 문장으로 모은다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${characterPath(CLOSED, "specup")}&sort=DELTA`);
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    await table.locator("tbody tr").first().waitFor();
    await expect(table.locator("tbody tr").filter({ hasText: "테스트 투구" })).toHaveCount(0);
    const folded = page.getByRole("region", { name: "아직 계산하지 않은 후보" });
    const group = folded.locator("summary").filter({ hasText: TEXT });
    await expect(group).toHaveCount(1);
    // Kinds in candidate-id order: EQUIPMENT_ADVANCED_REFINE before EQUIPMENT_REFINE.
    await expect(group).toContainText("상급 재련·재련 2개 —");
    await group.click();
    await expect(folded.locator("details li").filter({ hasText: "+19 테스트 투구 (+19 → +20)" })).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });

  // PM 총괄 11-22: the folded line sits under the whole list (50 rows), so a held dealer missed why armour has no
  // 전투력. One notice above the list: the api sentence once, and where the rows are. Drawn with the list (CLS 0).
  test(`${width}: 문 밖 — 목록 위에 방어구 보류 안내 하나(api 문장 + 접힌 줄 위치), 흔들림 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await page.goto(`${characterPath(CLOSED, "specup")}&sort=DELTA`);
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    await table.locator("tbody tr").first().waitFor();
    const notice = page.getByText(HELD_POINTER);
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText(TEXT);
    // Above the table, not under it.
    const [n, t] = [await notice.boundingBox(), await table.boundingBox()];
    expect(n.y + n.height).toBeLessThanOrEqual(t.y);
    // The sentence once in the notice, once in the folded line (not more).
    await expect(page.getByText(TEXT)).toHaveCount(2);
    await page.waitForTimeout(400);
    const { all, moved } = await shiftsSince(page, 0);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

  test(`${width}: 문 안 — 방어구 보류 안내가 없다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${characterPath(OPEN, "specup")}&sort=DELTA`);
    await page.getByRole("table", { name: /스펙업 후보/ }).locator("tbody tr").first().waitFor();
    await expect(page.getByText(HELD_POINTER)).toHaveCount(0);
    await expect(page.getByText(TEXT)).toHaveCount(0);
  });

  test(`${width}: 문 안 — 목표 경로의 방어구 재련 · 상급 재련 단계가 시뮬레이터로 넘어간다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${characterPath(OPEN, "specup")}&sort=DELTA`);
    const goal = page.getByRole("region", { name: "목표 전투력" });
    // Past both armour steps at the end of the mock path (12,498.02 and 12,506.27).
    await goal.getByRole("textbox", { name: "목표 전투력" }).fill("12507");
    await goal.getByRole("button", { name: "경로 찾기" }).click();
    await expect(goal.getByText("상급 재련 20단계").first()).toBeVisible();
    await expect(goal).not.toContainText("시뮬레이터에서 아직 바꿀 수 없어 빼고 열어요");
    const asked = simulateRequest(page);
    await goal.getByRole("link", { name: "이 경로를 시뮬레이터에서 열기" }).click();
    const changes = (await asked).postDataJSON().changes;
    expect(changes).toContainEqual({ kind: "EQUIPMENT_REFINE", index: 1, refine: 20 });
    expect(changes).toContainEqual({ kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, level: 20 });
    await expectNoHorizontalOverflow(page);
  });
}
