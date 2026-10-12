// 회귀: 랭킹 화면 3종(K32·L37·L38·L39) — 캐릭터 랭킹의 최고 전투력·아크 패시브·직업 각인·에스더 무기 열,
// 팔찌·젬 효율 랭킹 탭. 관측하지 못한 칸은 '-'로 자리를 지킨다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

test("캐릭터 랭킹에 K32 열 4개, 값이 없으면 '-' @regression", async ({ page }) => {
  await gotoReady(page, "/rankings");
  const table = page.getByRole("table");
  for (const name of ["최고 전투력", "아크 패시브", "직업 각인", "에스더 무기"])
    await expect(table.getByRole("columnheader", { name, exact: true })).toBeVisible();
  // 목: 5위는 에스더 +25·엘라 2단계, 3위는 관측 없음
  const fifth = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "랭커5", exact: true }) });
  await expect(fifth).toContainText("+25 · 엘라 2단계");
  const third = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "랭커3", exact: true }) });
  await expect(third.getByRole("cell", { name: "-", exact: true })).toHaveCount(4);
  const first = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "랭커1", exact: true }) });
  await expect(first).toContainText(/진화 140 · 깨달음 \d+ · 도약 70/);
});

for (const [type, title, column] of [
  ["bracelets", "팔찌 효율 랭킹", "팔찌 효율"],
  ["gems", "젬 효율 랭킹", "젬 효율"],
]) {
  test(`${title}: 탭, 효율 열, 집계 대상 안내 @regression`, async ({ page }) => {
    await gotoReady(page, `/rankings?type=${type}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const tabs = page.getByRole("tablist", { name: "랭킹 종류" });
    await expect(tabs.getByRole("tab", { name: type === "bracelets" ? "팔찌" : "젬" })).toHaveAttribute("aria-selected", "true");
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: column, exact: true })).toBeVisible();
    await expect(table.getByRole("row").nth(1)).toContainText(/\+\d+\.\d{2}%/);
    await expect(page.getByText("캐릭터 검색으로 장비를 관측해 효율을 계산한 캐릭터만 순위에 들어갑니다.")).toBeVisible();
  });
}

test("랭킹 종류 탭으로 팔찌 → 젬 → 캐릭터 이동 @regression", async ({ page }) => {
  await gotoReady(page, "/rankings?type=bracelets");
  const tabs = page.getByRole("tablist", { name: "랭킹 종류" });
  await tabs.getByRole("tab", { name: "젬" }).click();
  await expect(page).toHaveURL(/type=gems/);
  await expect(page.getByRole("heading", { level: 1, name: "젬 효율 랭킹" })).toBeVisible();
  await tabs.getByRole("tab", { name: "캐릭터" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "랭킹" })).toBeVisible();
});
