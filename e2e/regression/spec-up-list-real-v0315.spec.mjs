// 회귀(PM 총괄 11-21, v0.3.15): 스펙업 목록이 실제 답을 제대로 그린다. 표본은 계산 검증이 develop c76685dc 스텁 api로
// 웹과 같은 limit=50 요청을 보내 저장한 4명 × 크라켄 점수 · 효율 · 증가(이름 가림 '실목록1~4'), 그리고 실목록2의 limit=200
// 크라켄 점수 답('실목록2전체': 50개 요청에는 들지 못하는 무기 상급 재련 Δ점수 줄을 읽으려고).
// - 크라켄 점수 목록 아래: develop의 첫 문장('계산된 후보 N개 중 위에서 M개를 보여 드려요.')은 그대로, 보인 순위 줄 중 전투력이
//   없는 줄이 있으면 '그중 K개는 전투력을 아직 계산하지 않았어요.'를 붙인다. api는 크라켄 점수에서 전투력이 있는 줄과 점수만
//   있는 줄을 함께 점수 순으로 매긴다(SpecUpService: 순위 = OK이거나 Δ점수가 있음). K는 전투력 칸의 '—'와 같은 판정
//   (noCombatPower)으로 센다. 서포터(모든 줄이 전투력 없음)는 붙이지 않는다.
// - 모든 표본: 320 · 1280에서 위 문장이 표본에서 센 수와 같고, 칸 잘림 · 가로 넘침이 없다.
// - 상급 재련 줄, 여러 단계 재련 줄, 완갑 이름(접힌 줄).
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

const DIR = fileURLToPath(new URL("../../tests/spec-up-fixtures/v0315-list/", import.meta.url));
const FIXTURES = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => {
    const [who, sort] = f.replace(".json", "").split("-");
    return { who, sort, data: JSON.parse(readFileSync(DIR + f, "utf8")).data };
  });

/** The footer the list should show, counted from the answer the way the screen splits it. */
function footerOf({ data }) {
  const kraken = data.sort === "KRAKEN";
  const ranked = data.candidates.filter((c) => (kraken ? c.deltaKrakenScore != null : c.status === "OK"));
  const noCp = kraken ? ranked.filter((c) => c.deltaCombatPower == null).length : 0;
  const note = noCp > 0 && noCp < ranked.length;
  if (data.total > ranked.length)
    return `계산된 후보 ${data.total}개 중 위에서 ${ranked.length}개를 보여 드려요.${note ? ` 그중 ${noCp}개는 전투력을 아직 계산하지 않았어요.` : ""}`;
  return note ? `보여 드린 ${ranked.length}개 중 ${noCp}개는 전투력을 아직 계산하지 않았어요.` : null;
}

const list = async (page, who, sort) => {
  await page.goto(`${characterPath(who, "specup")}&sort=${sort}`);
  const table = page.getByRole("table", { name: /스펙업 후보/ });
  await table.locator("tbody tr").first().waitFor();
  return table;
};

/** No cell clipped inside the table (A37: each cell's own text fits). */
async function expectNoClippedCell(table) {
  const clipped = await table.evaluate((t) =>
    [...t.querySelectorAll("td, th")]
      .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
      .map((cell) => cell.innerText.replace(/\s+/g, " ").slice(0, 40)),
  );
  expect(clipped, "잘린 칸").toEqual([]);
}

test("표본의 크라켄 점수 목록 문장 수가 정해진 경우를 모두 지난다(전투력 없는 줄이 있음 · 없음 · 50개에서 잘림 · 안 잘림)", () => {
  const footers = Object.fromEntries(FIXTURES.map((f) => [`${f.who}-${f.sort}`, footerOf(f)]));
  // 실목록1: 41 ranked by the api, 36 with a score shown, 24 of them without combat power.
  expect(footers["실목록1-KRAKEN"]).toBe("계산된 후보 41개 중 위에서 36개를 보여 드려요. 그중 24개는 전투력을 아직 계산하지 않았어요.");
  // 실목록2 at limit 50: every ranked row has combat power, so develop's sentence alone.
  expect(footers["실목록2-KRAKEN"]).toBe("계산된 후보 136개 중 위에서 50개를 보여 드려요.");
  expect(footers["실목록2전체-KRAKEN"]).toBe("계산된 후보 136개 중 위에서 131개를 보여 드려요. 그중 57개는 전투력을 아직 계산하지 않았어요.");
  expect(footers["실목록2-EFFICIENCY"]).toBe("계산된 후보 91개 중 위에서 50개를 보여 드려요.");
});

for (const width of [320, 1280]) {
  for (const fixture of FIXTURES)
    test(`${width}: ${fixture.who} ${fixture.sort} — 목록 아래 문장이 표본에서 센 수, 칸 잘림 · 넘침 없음 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const table = await list(page, fixture.who, fixture.sort);
      const footer = footerOf(fixture);
      if (footer) await expect(page.getByText(footer, { exact: true })).toBeVisible();
      else await expect(page.getByText(/계산된 후보 \d+개 중|전투력을 아직 계산하지 않았어요/)).toHaveCount(0);
      // The no-combat-power count never drifts from the dash test: the old '그 아래에' wording is gone.
      await expect(page.getByText(/그 아래에 이어요/)).toHaveCount(0);
      await expectNoClippedCell(table);
      await expectNoHorizontalOverflow(page);
    });

  test(`${width}: 크라켄 점수 목록이 자리 잡는 동안 흔들림 0, 첫 줄은 답의 첫 순위 줄 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await watchShifts(page);
    const table = await list(page, "실목록1", "KRAKEN");
    const mark = await shiftMark(page);
    const first = FIXTURES.find((f) => f.who === "실목록1" && f.sort === "KRAKEN").data.candidates.find((c) => c.deltaKrakenScore != null);
    await expect(table.locator("tbody tr").first()).toContainText(first.target);
    await page.waitForTimeout(500);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
  });

  test(`${width}: 무기 상급 재련 Δ점수 줄(limit 200 답)은 '상급 재련 21단계 → 22단계'와 +3.02 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const table = await list(page, "실목록2전체", "KRAKEN");
    const row = table.locator("tbody tr").filter({ hasText: "+16 운명의 업화 한손검" }).filter({ hasText: "상급 재련 22단계" });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("상급 재련 21단계 → 상급 재련 22단계");
    await expect(row).toContainText("+3.02");
    if (width >= 768) await expect(row.locator("[data-cell='kind']")).toHaveText("상급 재련");
  });

  test(`${width}: 증가 목록 — 한 번에 여러 단계 오르는 재련 줄과, 접힌 방어구 상급 재련 줄 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    // DELTA: the weapon's +16 → +25 row is in the limit-50 answer there (not under 효율, where the 50 cut leaves it out).
    const table = await list(page, "실목록2", "DELTA");
    const row = table.locator("tbody tr").filter({ hasText: "+16 운명의 업화 한손검" }).filter({ hasText: "+16 → +25" });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("+141.65");
    // The 5 armour 상급 재련 rows come UNSUPPORTED (CP null): folded with the api's sentence, named 상급 재련.
    const folded = page.getByRole("region", { name: "아직 계산하지 않은 후보" });
    await expect(folded.locator("summary")).toContainText("상급 재련");
    await folded.locator("summary").click();
    await expect(folded.locator("details li").filter({ hasText: "상급 재련 20단계 → 상급 재련 21단계" })).toHaveCount(5);
  });

  test(`${width}: 접힌 줄 — 완갑 줄은 '완갑'으로 부르고(재련 아님), api 문장 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await list(page, "실목록1", "KRAKEN");
    const group = page.getByRole("region", { name: "아직 계산하지 않은 후보" }).locator("summary").filter({ hasText: "계산식을 아직 확인하고" });
    await expect(group).toHaveText("아크 그리드·아크 패시브·팔찌·완갑 8개 — 이 항목의 전투력 계산식을 아직 확인하고 있어 계산하지 않았습니다.");
  });
}
