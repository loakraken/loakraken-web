// 회귀(L36·K28, API 목록 #4): 랭킹 '길드' 탭 — 확인한 길드원으로 묶은 길드의 아이템 레벨 평균·합 순위.
// 길드원 수는 '확인한' 수라고 적고, 기준(평균↔합)·서버를 바꾸면 순위가 바뀐다. 집계 기준은 길드 단위로.
import { test, expect, gotoReady, chooseOption } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

test("길드 랭킹: 탭·열·기준 전환·서버·안내 @regression", async ({ page }) => {
  await gotoReady(page, "/rankings?type=guilds");
  await expect(page.getByRole("tab", { name: "길드", selected: true })).toBeVisible();
  const table = page.getByRole("table").first();
  await expect(table.getByRole("columnheader")).toHaveText(["순위", "길드", "서버", "아이템 레벨 평균", "확인한 길드원", "전투력 평균"]);
  await expect(table.getByRole("rowheader")).toHaveText(["합성길드", "두번째길드", "작은길드"]);
  await expect(table.locator("tbody tr").first()).toContainText("24명");
  // The default is the item level 1750+ members' combat power average (api #589):
  // the count under it, and a guild with none of them says so, with no rank.
  await expect(page).not.toHaveURL(/sort=/);
  await expect(page.getByRole("group", { name: "기준" }).getByRole("button", { name: "전투력 평균" })).toHaveAttribute("aria-pressed", "true");
  await expect(table.locator("tbody tr").first()).toContainText("3,402.18");
  await expect(table.locator("tbody tr").first()).toContainText("1750 이상 15명");
  await expect(table.locator("tbody tr").nth(2)).toContainText("1750 이상 없음");
  await expect(table.locator("tbody tr").nth(2).locator("td").first()).toHaveText("-");
  await expect(table.locator("tbody tr").nth(1).locator("td").first()).toHaveText("2");
  await expect(page.getByText(/아이템 레벨 1,750 이상 길드원만 세요/)).toBeVisible();
  // The basis names both: the 1,640+ range of the guilds, and on its own line the 1,750+ members the average counts.
  await expect(page.getByText(/아이템 레벨 1,640 이상 318개 길드 기준 · 공식 랭킹이 아니에요/)).toBeVisible();
  await expect(page.getByText("전투력 평균은 1,750 이상 길드원만", { exact: true })).toBeVisible();
  await expect(page.getByText(/실제 길드 인원이 아니에요/)).toBeVisible();
  await expect(page.getByText(/41개\)/)).toBeVisible();

  await page.getByRole("group", { name: "기준" }).getByRole("button", { name: "아이템 레벨 합" }).click();
  await expect(page).toHaveURL(/sort=SUM/);
  await expect(table.getByRole("columnheader").nth(3)).toHaveText("아이템 레벨 합");
  await expect(table.getByRole("rowheader")).toHaveText(["합성길드", "두번째길드", "작은길드"]);
  // Ranked by item level, every guild has its rank again.
  await expect(table.locator("tbody tr").nth(2).locator("td").first()).toHaveText("3");

  // 전투력 합: every member with a combat power record; fewer than the members seen says so.
  await page.getByRole("group", { name: "기준" }).getByRole("button", { name: "전투력 합" }).click();
  await expect(page).toHaveURL(/sort=CP_SUM/);
  await expect(table.getByRole("columnheader").nth(5)).toHaveText("전투력 합");
  await expect(table.locator("tbody tr").nth(2)).toContainText("2명 합");
  // The total counts every member with a combat power record: the second line says so.
  await expect(page.getByText("전투력 합은 확인한 길드원 전원", { exact: true })).toBeVisible();
  await expect(page.getByText("전투력 평균은 1,750 이상 길드원만", { exact: true })).toHaveCount(0);

  // A small sample: values shown as reference, no ranks yet.
  await chooseOption(page, page.getByRole("combobox", { name: "서버" }), "아만");
  await expect(table.getByRole("rowheader")).toHaveText(["합성길드아만", "짧은길드"]);
  await expect(table.locator("tbody tr td").first()).toHaveText("-");
  await expect(page.getByText(/표본 30개 길드가 모이면 순위를 보여 드려요/)).toBeVisible();
});

test("@M21 길드 찾기: 이름 일부로 거르고 순위는 전체 순위 그대로, 빠진 길드는 이유를 말한다 @regression", async ({ page }) => {
  await gotoReady(page, "/rankings?type=guilds");
  const table = page.getByRole("table").first();
  const search = page.getByRole("searchbox", { name: "길드 찾기" });
  await search.fill("두번");
  await expect(page).toHaveURL(/guild=%EB%91%90%EB%B2%88/);
  await expect(table.getByRole("rowheader")).toHaveText(["두번째길드"]);
  // The overall rank stays (2nd), not 1.
  await expect(table.locator("tbody tr td").first()).toHaveText("2");
  await search.fill("빠진");
  await expect(page.getByText("‘빠진’이(가) 들어간 길드 2개는 확인한 길드원이 5명보다 적어 순위에 없어요.")).toBeVisible();
  // Symbols the backend would refuse: nothing sent, the hint says why (as the
  // input's description: its name stays "길드 찾기"), the last results dimmed.
  await search.fill("로아 사랑");
  await expect(page.getByText("글자와 숫자만 찾을 수 있어요.")).toBeVisible();
  await expect(search).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("searchbox", { name: "길드 찾기", exact: true })).toHaveCount(1);
  await expect(search).toHaveAccessibleName("길드 찾기");
  await expect(search).toHaveAccessibleDescription("글자와 숫자만 찾을 수 있어요.");
  await expect(page.locator("[data-stale]").first()).toBeVisible();
  await expect(page).toHaveURL(/guild=%EB%B9%A0%EC%A7%84/);
  await search.fill("");
  await expect(page).not.toHaveURL(/guild=/);
  await expect(table.getByRole("rowheader")).toHaveText(["합성길드", "두번째길드", "작은길드"]);
});

test("@M21 길드 찾기: 범위를 넘은 쪽 주소는 1쪽으로 @regression", async ({ page }) => {
  await gotoReady(page, `/rankings?type=guilds&guild=${encodeURIComponent("두번")}&page=3`);
  await expect(page).not.toHaveURL(/page=3/);
  await expect(page.getByRole("table").first().getByRole("rowheader")).toHaveText(["두번째길드"]);
  await expect(page.getByText(/순위에 없어요/)).toHaveCount(0);
});

// The correction happens before anything else is drawn: the page reads as
// loading until page 1 is here, like any other first load (A6, P3 from #733).
for (const width of [1280, 360])
  test(`@M21 길드 찾기: 범위를 넘은 쪽 주소 첫 로드 흔들림 0 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, `/rankings?type=guilds&guild=${encodeURIComponent("두번")}&page=3`);
    await expect(page.getByRole("table").first().getByRole("rowheader")).toHaveText(["두번째길드"]);
    await page.waitForTimeout(500);
    const load = await shiftsSince(page);
    expect(load.all, `첫 로드 흔들림 (${load.moved})`).toBe(0);
  });

// Pressing a 기준 rewrote the sentence above and the headings in place, and
// their words slid (0.0002~0.0011). Both are drawn anew per 기준 now.
for (const width of [1280, 360])
  test(`@A7 ${width} 길드 랭킹: 기준 네 개를 눌러도 흔들림 0(누른 직후 포함) @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/rankings?type=guilds");
    await expect(page.getByRole("table").first()).toBeVisible();
    await page.waitForTimeout(600);
    const group = page.getByRole("group", { name: "기준" });
    for (const label of ["전투력 합", "아이템 레벨 평균", "아이템 레벨 합", "전투력 평균"]) {
      const moved = await shiftsDuring(page, () => group.getByRole("button", { name: label, exact: true }).click(), 800);
      expect(moved.all, `${label} (${moved.moved})`).toBe(0);
    }
  });