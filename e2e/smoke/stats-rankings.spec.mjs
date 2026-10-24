// 통계(/stats, web #174)와 랭킹(/rankings, web #189).
// 수치는 목 서버 합성 값이라 값 자체가 아니라 탭·조건·주소·요청 흐름을 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";

test.describe("통계 @smoke", () => {
  test("요약과 직업 표를 보여 주고 가로 스크롤이 없다", async ({ page }) => {
    await gotoReady(page, "/stats");
    await expect(page.getByRole("heading", { level: 1, name: "캐릭터 통계" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "직업" })).toHaveAttribute("aria-selected", "true");
    const table = page.getByRole("table", { name: "직업별 인원과 전투력 분포" });
    await expect(table.getByRole("rowheader").first()).toBeVisible();
    // 전투력 분포 막대는 글로 읽을 수 있다(하위 10%·중간 50%·상위 10%).
    await expect(table.getByRole("img").first()).toHaveAccessibleName(/하위 10% .*중간 50% .*상위 10%/);
    await expectNoHorizontalOverflow(page);
  });

  test("탭을 바꾸면 주소에 남는다", async ({ page }) => {
    await gotoReady(page, "/stats");
    await page.getByRole("tab", { name: "서버" }).click();
    await expect(page).toHaveURL(/tab=servers/);
    await expect(page.getByRole("table", { name: "서버별 인원과 중앙값" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("tab", { name: "서버" })).toHaveAttribute("aria-selected", "true");
  });

  test("조건을 바꾸면 그 조건으로 다시 조회한다", async ({ page }) => {
    await gotoReady(page, "/stats");
    const request = page.waitForRequest(/\/api\/stats\/summary\?.*role=SUPPORT/);
    await chooseOption(page, page.getByRole("form", { name: "통계 조건" }).getByRole("combobox", { name: "역할" }), "서포터");
    await request;
    await expect(page).toHaveURL(/role=SUPPORT/);
  });

  test("아이템 레벨은 1,640(기본)·1,700 중에서 바로 고르고, 다른 값은 직접 넣는다", async ({ page }) => {
    await gotoReady(page, "/stats");
    const form = page.getByRole("form", { name: "통계 조건" });
    const presets = form.getByRole("group", { name: "아이템 레벨 바로 고르기" });
    const field = form.getByRole("textbox", { name: "아이템 레벨 이상" });
    // 1,640 is the backend default: pressed, and nothing is sent for it.
    await expect(presets.getByRole("button", { name: "1,640" })).toHaveAttribute("aria-pressed", "true");
    const request = page.waitForRequest(/\/api\/stats\/summary\?.*itemLevelMin=1700/);
    await presets.getByRole("button", { name: "1,700" }).click();
    await request;
    await expect(page).toHaveURL(/itemLevelMin=1700/);
    await expect(field).toHaveValue("1700");
    await expect(presets.getByRole("button", { name: "1,700" })).toHaveAttribute("aria-pressed", "true");
    await presets.getByRole("button", { name: "1,640" }).click();
    await expect(page).not.toHaveURL(/itemLevelMin/);
    await expect(field).toHaveValue("");
    // A typed level leaves both presets up.
    await field.fill("1680");
    await expect(page).toHaveURL(/itemLevelMin=1680/);
    await expect(presets.getByRole("button", { pressed: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("분포 탭에서 내 전투력의 위치를 알려 준다", async ({ page }) => {
    await gotoReady(page, "/stats?tab=distribution");
    const panel = page.getByRole("tabpanel", { name: "분포" });
    await expect(panel.getByRole("button", { name: "전투력" })).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("textbox", { name: "내 전투력" }).fill("3000");
    await expect(panel).toContainText(/전투력 3,000은 상위 \d+% \([\d,]+위 \/ [\d,]+명\)/);
  });
});

test.describe("랭킹 @smoke", () => {
  test("전투력 랭킹 1쪽 50명, 행에서 캐릭터로 이동한다", async ({ page }) => {
    await gotoReady(page, "/rankings");
    await expect(page.getByRole("heading", { level: 1, name: "랭킹" })).toBeVisible();
    const table = page.getByRole("table", { name: "전투력 랭킹 1쪽" });
    await expect(table.locator("tbody tr")).toHaveCount(50);
    await expect(page.getByRole("form", { name: "랭킹 조건" })).toBeVisible();
    await table.getByRole("link", { name: "랭커1", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/character/${encodeURIComponent("랭커1")}$`));
  });

  test("아이템 레벨로 바꾸면 주소와 표가 바뀐다", async ({ page }) => {
    await gotoReady(page, "/rankings");
    await page.getByRole("form", { name: "랭킹 조건" }).getByRole("button", { name: "아이템 레벨" }).click();
    await expect(page).toHaveURL(/metric=ITEM_LEVEL/);
    await expect(page.getByRole("table", { name: "아이템 레벨 랭킹 1쪽" })).toBeVisible();
  });

  test("다음 쪽으로 넘긴다", async ({ page }) => {
    await gotoReady(page, "/rankings");
    await page.getByRole("link", { name: "다음" }).or(page.getByRole("button", { name: "다음" })).first().click();
    await expect(page.getByRole("table", { name: "전투력 랭킹 2쪽" })).toBeVisible();
    await expect(page).toHaveURL(/page=2/);
  });
});
