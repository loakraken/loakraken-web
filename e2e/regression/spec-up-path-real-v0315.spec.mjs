// v0.3.15 준비(PM 총괄 11-21): api develop c76685dc의 실제 추천 순서 답(#1019 한 단계 여러 레벨, #1029 방어구·완갑 점수
// 단계와 전투력 멈춤, #1033 상급 재련)을 그대로 그린다. 목: '실표본1~4'는 tests/spec-up-fixtures/v0315의 답(이름은 가림)을
// { ok, envelope } 그대로 준다. 320·1280에서 세 기준 모두: 대상·변화 글자가 잘리거나 칸 밖으로 나가지 않고, 숫자 칸이 줄마다
// 같은 자리에 서고, 합계가 '+ 비용 모름 N단계'를 세고, 점수 효율의 전투력 멈춤 문장, 시뮬레이터에서 빼는 단계 수(방어구 재련·
// 상급 재련), 가로 넘침 없음, 첫 로드 흔들림 0, 기준을 바꿀 때 입력 없는 흔들림 0. 순서가 다루는 범위 문장은 답에 있는
// 장신구 연마·깨달음 카르마를 뺀다고 말하지 않는다.
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";
import { readFileSync } from "node:fs";

/** The saved answer the mock serves for '실표본n' and a sort. */
const savedAnswer = (n, sort) =>
  JSON.parse(readFileSync(new URL(`../../tests/spec-up-fixtures/v0315/${n}-${sort}.json`, import.meta.url), "utf8")).data;
/** The screen's own number format (two decimals, Korean grouping). */
const two = (value) => value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const answer = (page) => page.getByRole("region", { name: "추천 순서", exact: true });
const rule = (page) => page.getByRole("group", { name: "추천 순서 고르는 기준" });
const pathTable = (page) => page.getByRole("table", { name: /^추천 순서, / });
const summary = (page) => answer(page).locator("p", { hasText: /^\d+단계를 차례로 올리면/ });
const STOP_REASON = "방어구·팔 보호구 재련은 전투력 계산식을 아직 확인하고 있어요. 점수와 비용은 그대로 셌어요.";

// [steps, unknownCostSteps, combatPowerStopOrder, simulator skips] per sample and sort, from the saved answers. Skips are
// for this build: KARMA_SIM and ARMOR_CP_SIM on (#1843), so armour 재련 opens and only the weapon 상급 재련 (실표본2,
// index 0, gear not 업화) stays out; the armour-off server's leg is e2e/armor-off. The unit test
// tests/spec-up-path-v0315.test.ts checks every switch combination against simulatorPath.
const SORTS = [
  ["효율 우선", "효율 우선 기준", "EFFICIENCY"],
  ["점수 효율", "크라켄 점수 기준", "KRAKEN"],
  ["전투력 우선", "전투력 우선 기준", "DELTA"],
];
const SAMPLES = {
  1: { EFFICIENCY: [12, 6, null, 0], KRAKEN: [18, 12, 8, 0], DELTA: [6, 0, null, 0] },
  2: { EFFICIENCY: [30, 3, null, 1], KRAKEN: [30, 2, null, 1], DELTA: [6, 0, null, 0] },
  3: { EFFICIENCY: [14, 5, null, 0], KRAKEN: [20, 11, 10, 0], DELTA: [7, 0, null, 0] },
  4: { EFFICIENCY: [30, 14, null, 0], KRAKEN: [30, 14, 18, 0], DELTA: [7, 0, null, 0] },
};

/** Problems in the shown rows: a clipped label, text leaving its cell, a figure column whose numbers do not line up. */
const layout = (page) =>
  answer(page).evaluate((region) => {
    const problems = [];
    const rows = [...region.querySelectorAll("tbody tr")];
    for (const el of region.querySelectorAll("tbody *"))
      if (getComputedStyle(el).textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1)
        problems.push(`잘림 '${el.textContent.trim()}' ${el.scrollWidth}>${el.clientWidth}`);
    // The target cell's button keeps its own (older) 6px offset from the cell edge; every other cell holds its text.
    for (const td of region.querySelectorAll("tbody [data-cell]:not([data-cell=target])")) {
      const R = td.getBoundingClientRect();
      for (const el of td.querySelectorAll("*")) {
        const X = el.getBoundingClientRect();
        if (X.width && (X.right > R.right + 1 || X.left < R.left - 1)) problems.push(`칸 밖 ${td.dataset.cell} '${el.textContent.trim()}'`);
      }
    }
    // Figures line up: in each figure column every row's text starts or ends at the same x.
    const range = document.createRange();
    for (const cell of ["gain", "cost", "eff"]) {
      const lefts = new Set();
      const rights = new Set();
      for (const tr of rows) {
        range.selectNodeContents(tr.querySelector(`[data-cell="${cell}"]`));
        const box = range.getBoundingClientRect();
        lefts.add(Math.round(box.left));
        rights.add(Math.round(box.right));
      }
      if (Math.min(lefts.size, rights.size) !== 1) problems.push(`줄 안 맞음 ${cell}: 왼쪽 ${[...lefts]} 오른쪽 ${[...rights]}`);
    }
    return problems;
  });

for (const width of [320, 1280])
  for (const n of [1, 2, 3, 4])
    test(`@A37 ${width} 실표본${n}: 세 기준의 실제 답이 잘림·넘침·흔들림 없이 그려진다 @regression`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await page.goto(characterPath(`실표본${n}`, "specup"));
      await expect(pathTable(page)).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const loaded = await shiftsSince(page);
      expect(loaded.all, `첫 로드 흔들림 (${loaded.moved})`).toBe(0);

      for (const [button, caption, sort] of SORTS) {
        const [steps, unknown, stop, skipped] = SAMPLES[n][sort];
        const mark = await shiftMark(page);
        await rule(page).getByRole("button", { name: button }).click();
        await expect(pathTable(page)).toHaveAccessibleName(`추천 순서, ${caption}`);
        await page.waitForTimeout(400);
        // Content below the pressed rule may grow with the new answer; nothing moves on its own.
        const switched = await shiftsSince(page, mark);
        expect(switched.quiet, `${button}: 입력 없는 흔들림 (${switched.moved})`).toBe(0);

        // The answer stays open on a switch (the row fold keeps its state), so it is opened only when folded.
        if (steps > 10) {
          const fold = answer(page).getByRole("button", { name: /^(\d+줄 모두 보기|앞 10줄만 보기)$/ });
          if ((await fold.textContent()) === `${steps}줄 모두 보기`) await fold.click();
          await expect(fold).toHaveText("앞 10줄만 보기");
        }
        await expect(pathTable(page).locator("tbody tr")).toHaveCount(steps);
        // Each row tells its own step of the saved answer (PM-프론트 #1845 P3): a jump drawn as one level, a row out of
        // order or a gain in the wrong figure fails here. KRAKEN rows are told in the score, the others in combat power.
        const saved = savedAnswer(n, sort).steps;
        const cells = (cell) => pathTable(page).locator(`tbody [data-cell="${cell}"]`).allTextContents();
        expect(await cells("rank"), `${button} 순서`).toEqual(saved.map((s) => String(s.order)));
        expect(await cells("change"), `${button} 변화`).toEqual(saved.map((s) => `${s.from} → ${s.to}`));
        const gain = (s) => (sort === "KRAKEN" ? s.deltaKrakenScore : s.deltaCombatPower);
        expect((await cells("gain")).map((text) => text.split("→")[0]), `${button} 오름`).toEqual(
          saved.map((s) => (gain(s) == null ? "—" : `+${two(gain(s))}`)),
        );
        if (unknown > 0) await expect(summary(page)).toContainText(` + 비용 모름 ${unknown}단계`);
        else await expect(summary(page)).not.toContainText("비용 모름");

        const cpStop = answer(page).getByText(/전투력을 계산하지 않았어요/);
        if (stop) await expect(cpStop).toHaveText(`${stop}단계부터는 전투력을 계산하지 않았어요. ${STOP_REASON}`);
        else await expect(cpStop).toHaveCount(0);

        const sim = answer(page).getByText(/시뮬레이터에서 아직 바꿀 수 없어 빼고 열어요/);
        if (skipped) await expect(sim).toContainText(`${skipped}개 단계는`);
        else await expect(sim).toHaveCount(0);
        await expect(answer(page).getByRole("link", { name: "이 순서를 시뮬레이터에서 열기" })).toBeVisible();

        expect(await layout(page), `${button} 줄 모양`).toEqual([]);
        await expectNoHorizontalOverflow(page);
      }
    });

// 장신구 연마 · 깨달음 카르마 join the path only behind api switches (both off on production, PM 총괄 11-21): the lead line
// names only the kinds every path takes, and the answer's own note says whether this answer takes those two, by the
// answer's polishStepsConsidered / karmaStepsConsidered; a missing field is false (today's words, PM 총괄 11-21).
const LEAD = "보석·재련·상급 재련·품질·각인·완갑·어빌리티 스톤 단계를 다뤄요.";
const BOTH = "이 순서는 장신구 연마·깨달음 카르마 단계도 다뤄요.";
const OFF = "장신구 연마는 비용을 늘 잡을 수 있게 되면 더하고, 깨달음 카르마는 전투력 계산식이 없어 넣지 않아요.";
const SCOPE = [
  ["실표본2", "두 필드 true, 두 종류 단계 있음", ["연마", "카르마"], BOTH],
  ["실표본1", "두 필드 true, 카르마 단계는 고르지 않음(필드를 따름)", ["연마"], BOTH],
  ["스펙순서범위꺼짐", "두 필드 false(운영, 스위치 꺼짐)", [], OFF],
  ["스펙순서", "필드 없음(필드 전 api)", [], OFF],
];
for (const [who, what, kinds, note] of SCOPE)
  test(`@A37 1280 다루는 범위: ${what} @regression`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(characterPath(who, "specup"));
    await expect(pathTable(page)).toBeVisible();
    const all = answer(page).getByRole("button", { name: /줄 모두 보기$/ });
    if (await all.count()) await all.click();
    // The answer's kinds, as the note will count them.
    const shown = await pathTable(page).locator('tbody [data-cell="kind"]').allTextContents();
    expect(["연마", "카르마"].filter((kind) => shown.includes(kind))).toEqual(kinds);
    await expect(answer(page).getByText(LEAD, { exact: true })).toBeVisible();
    await expect(answer(page).getByText(note, { exact: true })).toBeVisible();
  });

test("@A37 1280 방어구 문이 열린 빌드: 점수 효율 순서의 시뮬레이터 링크는 한 단계 점프를 목표 레벨로, 방어구 재련도 담는다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(characterPath("실표본1", "specup"));
  await rule(page).getByRole("button", { name: "점수 효율" }).click();
  await expect(pathTable(page)).toHaveAccessibleName("추천 순서, 크라켄 점수 기준");
  const link = answer(page).getByRole("link", { name: "이 순서를 시뮬레이터에서 열기" });
  const tried = JSON.parse(new URL(await link.getAttribute("href"), "http://x").searchParams.get("try"));
  // 실표본1 (ARMOR_CP_SIM on, this build): step 7 raises the weapon +22 → +25 in one step (it opens at +25), step 8 the
  // arm guard to 25, steps 9–13 each armour piece (index 5, 1, 4, 3, 2) to +25 in one step. Nothing skipped: 19 changes.
  // The armour-off server's leg (e2e/armor-off) holds the same link at 14 changes, weapon only.
  const refines = tried.filter((c) => c.kind === "EQUIPMENT_REFINE");
  expect(refines.map((c) => [c.index, c.refine])).toEqual([[0, 25], [5, 25], [1, 25], [4, 25], [3, 25], [2, 25]]);
  expect(tried.filter((c) => c.kind === "ARM_GUARD").map((c) => c.level)).toEqual([25]);
  expect(tried).toHaveLength(19);
  await expect(answer(page).getByText(/빼고 열어요/)).toHaveCount(0);
  await link.click();
  await expect(page).toHaveURL(/tab=simulator/);
  await expect(page.getByRole("heading", { name: "전투력 시뮬레이터" })).toBeVisible();
});
