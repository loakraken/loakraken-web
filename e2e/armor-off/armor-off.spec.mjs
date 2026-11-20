// 회귀(PM-프론트 #1843 P2): ARMOR_CP_SIM이 꺼진 서버(운영의 기본값; playwright.armor-off.config.mjs가 따로 띄움)에서는
// 시뮬레이터의 두 입구(캐릭터 시뮬레이터 탭 · /tools/combat-power) 모두 방어구 재련 · 상급 재련이 오늘처럼 잠기고, 안내는
// 오늘 문구이며, 스펙업 목록과 경로는 방어구 단계를 시뮬레이터로 넘기지 않고, 어떤 요청 본문에도 방어구 변경이 없다.
// '방어구문열림'(api가 방어구를 계산하는 캐릭터)으로 보아, 웹 스위치만으로 막히는지 본다.
import { test, expect, characterPath, chooseOption, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";

const NAME = "방어구문열림";
const TODAY = /무기 재련·아크 그리드 코어·아크 패시브 진화와 도약을 바꿀 수\s*있어요\. 방어구 재련·상급 재련·아크 패시브 깨달음·/;

/** Every simulate body the page sends; none may carry armour 재련 or any 상급 재련 (index 0 is the weapon). */
function watchBodies(page) {
  const bodies = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/combat-power/simulate") && request.method() === "POST") bodies.push(request.postDataJSON());
  });
  return () => {
    for (const body of bodies)
      for (const change of body.changes)
        expect(
          change.kind === "EQUIPMENT_ADVANCED_REFINE" || (change.kind === "EQUIPMENT_REFINE" && change.index !== 0),
          `방어구 변경이 나감: ${JSON.stringify(change)}`,
        ).toBe(false);
    return bodies.length;
  };
}

async function expectLockedArmour(page) {
  for (const name of ["투구 재련 단계", "투구 상급 재련 단계"]) await expect(page.getByRole("combobox", { name })).toHaveCount(0);
  await expect(page.getByText("재련 +19 · 준비 중")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "+19 테스트 투구" }).first()).toContainText("상급 10 · 준비 중");
  await expect(page.getByText(TODAY)).toBeVisible();
}

for (const [entry, path] of [
  ["도구 화면", `/tools/combat-power?character=${encodeURIComponent(NAME)}`],
  ["캐릭터 시뮬레이터 탭", characterPath(NAME, "simulator")],
])
  test(`${entry}: 방어구 재련 · 상급 재련은 오늘처럼 잠기고, 무기 재련만 보낸다`, async ({ page }) => {
    const sent = watchBodies(page);
    await gotoReady(page, path);
    await expectLockedArmour(page);
    const asked = page.waitForRequest((r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST");
    await chooseOption(page, page.getByRole("combobox", { name: "무기 재련 단계" }), "21");
    expect((await asked).postDataJSON().changes).toEqual([{ kind: "EQUIPMENT_REFINE", index: 0, refine: 21 }]);
    expect(sent(), "보낸 계산 요청").toBeGreaterThan(0);
    await expectNoHorizontalOverflow(page);
  });

// 실제 추천 순서 답(v0.3.15, '실표본1' 점수 효율, #1845): 꺼진 서버에서는 방어구 재련 다섯 단계(index 1–5)를 빼고, 한 단계에
// +22 → +25로 오르는 무기 재련은 목표 레벨로, 완갑은 25로 담는다(18단계 중 14개, 5개 뺌). 켜진 빌드의 같은 링크는 19개
// (e2e/regression/spec-up-path-real-v0315.spec.mjs).
test("실제 답의 점수 효율 순서: 시뮬레이터 링크는 방어구 재련 다섯 단계를 빼고 무기 재련만 목표 레벨로 담는다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(characterPath("실표본1", "specup"));
  const answer = page.getByRole("region", { name: "추천 순서", exact: true });
  await page.getByRole("group", { name: "추천 순서 고르는 기준" }).getByRole("button", { name: "점수 효율" }).click();
  await expect(page.getByRole("table", { name: /^추천 순서, / })).toHaveAccessibleName("추천 순서, 크라켄 점수 기준");
  await expect(answer).toContainText("5개 단계는 시뮬레이터에서 아직 바꿀 수 없어 빼고 열어요.");
  const link = answer.getByRole("link", { name: "이 순서를 시뮬레이터에서 열기" });
  const tried = JSON.parse(new URL(await link.getAttribute("href"), "http://x").searchParams.get("try"));
  expect(tried.filter((c) => c.kind === "EQUIPMENT_REFINE").map((c) => [c.index, c.refine])).toEqual([[0, 25]]);
  expect(tried.filter((c) => c.kind === "ARM_GUARD").map((c) => c.level)).toEqual([25]);
  expect(tried).toHaveLength(14);
});

test("스펙업 목록의 방어구 줄에는 '적용해 보기'가 없고, 경로는 방어구 단계를 빼고 연다", async ({ page }) => {
  const sent = watchBodies(page);
  await page.goto(`${characterPath(NAME, "specup")}&sort=DELTA`);
  const table = page.getByRole("table", { name: /스펙업 후보/ });
  await table.locator("tbody tr").first().waitFor();
  const more = table.getByRole("button", { name: /^자세히 · 다른 단계/ });
  for (let i = 0; i < 20 && (await more.count()) > 0; i += 1) await more.first().click();
  // The api computed the armour rows (inside the gate), so they are listed, but nothing opens them in the simulator.
  await expect(table.locator("tbody tr").filter({ hasText: "+19 테스트 투구" })).toHaveCount(2);
  await expect(table.getByRole("link", { name: /^\+19 테스트 투구 .*시뮬레이터에서 적용해 보기$/ })).toHaveCount(0);
  const goal = page.getByRole("region", { name: "목표 전투력" });
  await goal.getByRole("textbox", { name: "목표 전투력" }).fill("12507");
  await goal.getByRole("button", { name: "경로 찾기" }).click();
  await expect(goal).toContainText("2개 단계는 시뮬레이터에서 아직 바꿀 수 없어 빼고 열어요.");
  const asked = page.waitForRequest((r) => r.url().includes("/api/combat-power/simulate") && r.method() === "POST");
  await goal.getByRole("link", { name: "이 경로를 시뮬레이터에서 열기" }).click();
  await asked;
  await expectLockedArmour(page);
  expect(sent(), "보낸 계산 요청").toBeGreaterThan(0);
  await expectNoHorizontalOverflow(page);
});
