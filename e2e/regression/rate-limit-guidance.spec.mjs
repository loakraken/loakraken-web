// 회귀(v0.3.2 공식 칸 429 안내 묶음):
// (a) 멀티서치는 칸에 걸린 캐릭터를 남은 시간이 끝나면 누르지 않아도 그 캐릭터부터 다시 불러온다.
// (b) 이 방문자의 칸(CLIENT_RATE_LIMITED)은 '짧은 시간에 검색이 많아 잠깐 쉬어 가요'로, 사이트 전체 칸과 다르게.
// (c) 캐릭터 화면의 남은 시간은 버튼 하나에만('N초 뒤 다시 조회'), '남은 시간 N초'를 함께 보이지 않는다.
// (d) 원정대 전투력 불러오기가 다 못 불렀으면 'N명 남음 · M분 뒤 이어서 불러올 수 있어요'.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const PAUSE = "짧은 시간에 검색이 많아 잠깐 쉬어 가요";

test("@429 멀티서치: 칸에 걸린 캐릭터는 기다린 뒤 저절로 이어서 불러온다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const asked = [];
  let limited = false;
  await page.route("**/api/characters?*", async (route) => {
    const name = new URL(route.request().url()).searchParams.get("characterName");
    asked.push(name);
    if (name === "비교2" && !limited) {
      limited = true;
      const retryAt = Date.now() + 2500;
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": "3", "Cache-Control": "no-store" },
        json: { ok: false, error: { code: "LOST_ARK_RATE_LIMITED", status: 429, retryAt, limit: "client" } },
      });
    }
    return route.continue();
  });
  await gotoReady(page, "/multi-search");
  await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("비교1, 비교2 비교3");
  await page.getByRole("button", { name: "비교하기" }).click();
  const main = page.locator("main");
  // Stopped at 비교2 with the visitor's own words; 비교3 waits behind it.
  await expect(main.getByText(PAUSE).first()).toBeVisible();
  expect(asked.filter((n) => n === "비교3")).toEqual([]);
  // No click: once the wait is over, 비교2 and then 비교3 come in.
  await expect(main.getByText("3명을 비교하고 있어요")).toBeVisible({ timeout: 10_000 });
  expect(asked.filter((n) => n === "비교2")).toHaveLength(2);
  expect(asked.filter((n) => n === "비교3")).toHaveLength(1);
});

test("@429 캐릭터 화면: 방문자 칸 문구, 남은 시간은 버튼 하나에만 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoReady(page, characterPath("과다"));
  const alert = page.getByRole("alert").filter({ hasText: PAUSE });
  await expect(alert).toBeVisible();
  await expect(page.getByRole("button", { name: /초 뒤 다시 조회/ })).toBeVisible();
  // One count on screen: the 'N초 뒤 다시 조회' button, not also '남은 시간 N초'.
  await expect(page.getByText(/남은 시간 \d+초/)).toHaveCount(0);
});

test("@429 원정대 전투력: 다 못 불렀으면 남은 인원과 이어서 불러올 때 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("**/api/characters/roster-combat-power/refresh?*", async (route) => {
    const response = await route.fetch();
    // The web route's answer: { ok, envelope: { code, message, data } }.
    const body = await response.json();
    body.envelope.data.fetched = 8;
    body.envelope.data.remaining = 4;
    body.envelope.data.refreshAvailableAt = new Date(Date.now() + 60_000).toISOString();
    return route.fulfill({ response, json: body });
  });
  await gotoReady(page, characterPath("원정대전투력", "siblings"));
  const power = page.getByRole("region", { name: "원정대 전투력" });
  await power.getByRole("button", { name: "전투력 불러오기" }).click();
  await expect(power).toContainText("4명 남음 · 1분 뒤 이어서 불러올 수 있어요", { timeout: 10_000 });
  await expect(power.getByRole("button", { name: /뒤 다시 불러오기/ })).toBeVisible();
});
