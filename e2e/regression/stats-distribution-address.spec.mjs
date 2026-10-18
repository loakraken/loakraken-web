// QA v0.3.1 P1-3: on /stats?tab=distribution the typed value, its result and
// the table view were gone after a reload. They now ride in the address
// (?metric=, ?percentileOf=, ?view=table) and come back in the first HTML.
import { test, expect, chooseOption, gotoReady } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince } from "../support/shifts.mjs";

const panel = (page) => page.getByRole("tabpanel", { name: "분포" });
const RESULT = /전투력 3,000은 상위 \d+% \([\d,]+위 \/ [\d,]+명\)/;

test("통계 분포: 내 전투력·결과·표 보기가 새로고침에도 남는다 @regression", async ({ page }) => {
  await gotoReady(page, "/stats?tab=distribution&role=DEALER");
  await panel(page).getByRole("textbox", { name: "내 전투력" }).fill("3000");
  await expect(panel(page)).toContainText(RESULT);
  await panel(page).getByRole("button", { name: "표로 보기" }).click();
  await expect(page).toHaveURL(/[?&]percentileOf=3000(&|$)/);
  await expect(page).toHaveURL(/[?&]view=table(&|$)/);
  await expect(page).toHaveURL(/[?&]role=DEALER(&|$)/); // the filters stay

  await watchShifts(page);
  await page.reload();
  await expect(panel(page).getByRole("textbox", { name: "내 전투력" })).toHaveValue("3000");
  await expect(panel(page)).toContainText(RESULT);
  await expect(panel(page).getByRole("button", { name: "그래프로 보기" })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "그래프로 보기" })).not.toHaveAttribute("aria-pressed");
  await expect(panel(page).getByRole("table", { name: "전투력 구간별 인원" })).toBeVisible();
  // The result and the table are in the first HTML: nothing moves after load.
  await page.waitForTimeout(800);
  const shifts = await shiftsSince(page);
  expect(shifts.all, shifts.moved).toBe(0);

  // A filter changed on this tab keeps the tab's choices.
  await chooseOption(page, page.getByRole("combobox", { name: "역할" }), "전체");
  await expect(page).not.toHaveURL(/role=/);
  await expect(page).toHaveURL(/[?&]percentileOf=3000(&|$)/);
  await expect(page).toHaveURL(/[?&]view=table(&|$)/);
});

test("통계 분포: 아이템 레벨 주소로 바로 열리고, 잘못된 값은 그 값만 버린다 @regression", async ({ page }) => {
  await gotoReady(page, "/stats?tab=distribution&metric=ITEM_LEVEL&role=SUPPORT");
  await expect(panel(page).getByRole("button", { name: "아이템 레벨" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).getByRole("textbox", { name: "내 아이템 레벨" })).toHaveValue("");
  await gotoReady(page, "/stats?tab=distribution&percentileOf=-5&role=SUPPORT");
  await expect(panel(page).getByRole("button", { name: "전투력" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).getByRole("textbox", { name: "내 전투력" })).toHaveValue("");
  // The filter next to the bad value still applies.
  await expect(page.getByRole("combobox", { name: "역할" })).toContainText("서포터");
});
