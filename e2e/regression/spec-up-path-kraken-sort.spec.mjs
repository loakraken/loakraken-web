// 추천 순서 '점수 효율' (sort=KRAKEN, api #967): built hidden (PM 총괄 11-15), shown only where the api
// says it runs for the character (supportOrderAvailable, api #971); a supporter's default once it does.
// The web never asks the path with sort=KRAKEN to find out (백엔드 11-15). Mock: '점수순서딜러' and
// '점수순서서폿' have the switch on (the supporter's answer is the api's own #969 test answer);
// '스펙순서' and '상세서포터' have it off.
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const chips = (page) => page.getByRole("group", { name: "정렬" });
const rule = (page) => page.getByRole("group", { name: "추천 순서 고르는 기준" });
// The 추천 순서 answer (the rule's hidden description sits in the bar above, not here).
const answer = (page) => page.getByRole("region", { name: "추천 순서", exact: true });
const pathTable = (page) => page.getByRole("table", { name: /^추천 순서, / });
const rows = (page) => pathTable(page).locator("tbody tr:not([data-collapsed])");
const pathAsked = (r) => r.url().includes("/api/characters/spec-up/path?");
const sortOf = (r) => new URL(r.url()).searchParams.get("sort");
// The api's rule for sort=KRAKEN in words (api 29a1fd11: extra cost ≤ 0 first, then score per 100,000 gold).
const RULE = "10만 골드당 점수가 많이 오르는 순서예요. 더 드는 비용이 없는 단계가 먼저 와요.";

/** Every path request's sort, from before the page opens. */
const watchPathSorts = (page) => {
  const sorts = [];
  page.on("request", (r) => {
    if (pathAsked(r)) sorts.push(sortOf(r));
  });
  return sorts;
};

for (const width of [320, 1280]) {
  test(`딜러, 스위치 켜짐: '점수 효율'이 셋째 기준으로 보이고, 누르면 크라켄 점수 순서 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const sorts = watchPathSorts(page);
    await page.goto(characterPath("점수순서딜러", "specup"));
    await expect(rule(page).getByRole("button")).toHaveText(["효율 우선", "전투력 우선", "점수 효율"]);
    await expect(rule(page).getByRole("button", { name: "효율 우선" })).toHaveAttribute("aria-pressed", "true");
    await expect(pathTable(page)).toHaveAccessibleName("추천 순서, 효율 우선 기준");
    expect(sorts).toEqual(["EFFICIENCY"]);
    await expectNoHorizontalOverflow(page);

    const asked = page.waitForRequest((r) => pathAsked(r) && sortOf(r) === "KRAKEN");
    await rule(page).getByRole("button", { name: "점수 효율" }).click();
    await asked;
    await expect(rule(page).getByRole("button", { name: "점수 효율" })).toHaveAttribute("aria-pressed", "true");
    // What it ranks by, per 100,000 gold (#1734 P2): the button's description and the answer's own line.
    await expect(rule(page).getByRole("button", { name: "점수 효율" })).toHaveAccessibleDescription(RULE);
    await expect(answer(page).getByText(RULE, { exact: true })).toBeVisible();
    await expect(pathTable(page)).toHaveAccessibleName("추천 순서, 크라켄 점수 기준");
    await expect(rows(page).first().locator('[data-cell="gain"]')).toContainText("+7.50");
    await expect(page.getByText("시세가 있는 항목 가운데 점수가 오르는 것을 모두 골랐어요.")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test(`서포터, 스위치 켜짐: 추천 순서가 처음 보기이고 서포터 점수 순서 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const sorts = watchPathSorts(page);
    await page.goto(characterPath("점수순서서폿", "specup"));
    await expect(chips(page).getByRole("button")).toHaveText(["추천 순서", "서포터 점수 기준"]);
    await expect(chips(page).getByRole("button", { name: "추천 순서" })).toHaveAttribute("aria-pressed", "true");
    // The score is a supporter's only order: one rule, pressed.
    await expect(rule(page).getByRole("button")).toHaveText(["점수 효율"]);
    await expect(rule(page).getByRole("button", { name: "점수 효율" })).toHaveAttribute("aria-pressed", "true");
    await expect(rule(page).getByRole("button", { name: "점수 효율" })).toHaveAccessibleDescription(RULE);
    await expect(pathTable(page)).toHaveAccessibleName("추천 순서, 서포터 점수 기준");
    await expect(answer(page).getByText(RULE, { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(5);
    await expect(page.getByText(/5단계를 차례로 올리면 서포터 점수 5,286\.48 → 5,490\.12/)).toBeVisible();
    await expect(pathTable(page)).not.toContainText("NaN");
    // The simulator is combat power: no link for a supporter.
    await expect(page.getByRole("link", { name: "이 순서를 시뮬레이터에서 열기" })).toHaveCount(0);
    expect(sorts).toEqual(["KRAKEN"]);
    await expectNoHorizontalOverflow(page);

    // The list is still there, one chip away.
    await chips(page).getByRole("button", { name: "서포터 점수 기준" }).click();
    await expect(chips(page).getByRole("button", { name: "서포터 점수 기준" })).toHaveAttribute("aria-pressed", "true");
    await expect(pathTable(page)).toHaveCount(0);
  });
}

test("스위치 꺼짐(딜러): 기준은 둘, 경로에 sort=KRAKEN을 묻지 않음", async ({ page }) => {
  const sorts = watchPathSorts(page);
  await page.goto(characterPath("스펙순서", "specup"));
  await expect(rule(page).getByRole("button")).toHaveText(["효율 우선", "전투력 우선"]);
  await rule(page).getByRole("button", { name: "전투력 우선" }).click();
  await expect(pathTable(page)).toHaveAccessibleName("추천 순서, 전투력 우선 기준");
  expect(sorts).toEqual(["EFFICIENCY", "DELTA"]);
  // The score rule's line belongs to a KRAKEN answer only.
  await expect(answer(page).getByText(RULE, { exact: true })).toHaveCount(0);
});

test("스위치 꺼짐(서포터): 추천 순서 칩 없이 서포터 점수 목록, 경로는 묻지 않음", async ({ page }) => {
  const sorts = watchPathSorts(page);
  await page.goto(characterPath("상세서포터", "specup"));
  await expect(chips(page).getByRole("button")).toHaveText(["서포터 점수 기준"]);
  await expect(rule(page)).toHaveCount(0);
  await expect(page.getByRole("table", { name: /^스펙업 후보, 서포터 점수 순/ })).toBeVisible();
  expect(sorts).toEqual([]);
});
