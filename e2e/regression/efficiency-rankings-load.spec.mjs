// 회귀: 팔찌·젬 효율 랭킹이 처음 그려질 때 움직이지 않는다 — 답이 0줄·3줄·50줄 어느 쪽이어도
// 표 아래 안내가 위로 당겨 올라오지 않는다(A7). 표본을 모으는 중이면 위 안내에 그렇게 적고,
// 효율의 뜻은 답의 ruleVersion을 따른다(실 효율 = 캐릭터 화면 값, 그 밖 = 전투력 기준).
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const REAL = { bracelets: "bracelet-real-v1", gems: "ark-grid-real-v1" };

/** The answer cut to `count` rows, as a fresh ranking still collecting would send it. */
const cutTo = (page, count, ruleVersion) =>
  page.route("**/api/rankings/efficiency**", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.data.rows = body.data.rows.slice(0, count).map((row) => ({ ...row, topPercent: count < 50 ? null : row.topPercent, tier: count < 50 ? null : row.tier }));
    body.data.ruleVersion = ruleVersion;
    if (count < 50) Object.assign(body.data.meta, { population: count, sampleStatus: "COLLECTING" });
    await route.fulfill({ response: res, json: body });
  });

for (const type of ["bracelets", "gems"])
  for (const count of [0, 3, 50])
    for (const width of [320, 360, 390, 1280])
      test(`@효율랭킹 ${type} ${count}줄 ${width}: 첫 그림 흔들림 0 @regression`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await cutTo(page, count, REAL[type]);
        await watchShifts(page);
        await gotoReady(page, `/rankings?type=${type}`);
        if (count === 0) await expect(page.getByText("조건에 맞는 캐릭터가 없어요.")).toBeVisible();
        else await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(count);
        const notice = page.getByText(/^공식 랭킹이 아니에요/);
        if (count < 50) await expect(notice).toContainText("아직 표본을 모으고 있어요");
        else await expect(notice).not.toContainText("표본을 모으고");
        await page.waitForTimeout(600);
        const { all, moved } = await shiftsSince(page);
        expect(all, `첫 그림 흔들림 (${moved})`).toBe(0);
      });

for (const [type, real, old] of [
  ["bracelets", "캐릭터 화면의 팔찌 효율과 같은 값이에요.", "팔찌를 뺀 전투력과 비교했어요."],
  ["gems", "캐릭터 화면의 아크 그리드 효율과 같은 값이에요.", "젬 옵션을 뺀 전투력과 비교했어요."],
]) {
  test(`@효율랭킹 ${type}: 효율의 뜻이 ruleVersion을 따름 @regression`, async ({ page }) => {
    await cutTo(page, 3, REAL[type]);
    await gotoReady(page, `/rankings?type=${type}`);
    await expect(page.getByText(real)).toBeVisible();
    await expect(page.getByText(old)).toHaveCount(0);
  });
  test(`@효율랭킹 ${type}: 예전 규칙이면 전투력 기준 설명 @regression`, async ({ page }) => {
    await gotoReady(page, `/rankings?type=${type}`);
    await expect(page.getByText(old)).toBeVisible();
    await expect(page.getByText(real)).toHaveCount(0);
  });
}
