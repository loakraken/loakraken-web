// 회귀(PM 총괄 11-16 P3, api #989 계산 자리는 클라이언트당 1개): 추천 순서 기준을 바꾸면 앞 기준의 계산이 아직 이
// 클라이언트의 자리를 쥐고 있어(브라우저는 요청을 버려도 서버는 끝까지 계산) 새 기준 요청이 바로 429 SPEC_UP_BUSY가
// 된다. 평범한 기준 바꿈에 몰림 안내가 뜨면 안 된다: 웹은 Retry-After 뒤 다시 묻고, 그동안 앞 순서를 그대로 둔다.
import { test, expect, characterPath } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const rule = (page) => page.getByRole("group", { name: "추천 순서 고르는 기준" });
const region = (page) => page.getByRole("region", { name: "추천 순서" });

test("기준을 바꾼 첫 요청이 계산 자리 몰림이면 안내 없이 다시 물어 새 순서를 보이고, 그동안 앞 순서가 남음 @regression", async ({ page }) => {
  await watchShifts(page);
  await page.setViewportSize({ width: 360, height: 800 });
  let delta = 0;
  // The new rule's first answer: this client's seat is still held by the first rule's computation.
  await page.route("**/api/characters/spec-up/path?*", async (route) => {
    if (!route.request().url().includes("sort=DELTA")) return route.fallback();
    delta += 1;
    if (delta > 1) return route.fallback();
    // The app's own route answers { ok, error } (lib/api/respond.ts), with the backend's Retry-After as retryAt.
    await route.fulfill({ status: 429, json: { ok: false, error: { code: "SPEC_UP_BUSY", status: 429, retryAt: Date.now() + 1000 } } });
  });
  await page.goto(characterPath("스펙순서", "specup"));
  await expect(page.getByRole("table", { name: /^추천 순서, / }).locator("tbody tr")).toHaveCount(2);
  const shifts = await shiftsDuring(page, async () => {
    await rule(page).getByRole("button", { name: "전투력 우선" }).click();
    // While it waits and asks again, the shown order stays and no notice appears.
    await expect.poll(() => delta).toBe(1);
    await expect(region(page).getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("table", { name: "추천 순서, 전투력 우선 기준" })).toBeVisible({ timeout: 10_000 });
  });
  expect(delta, "몰림 한 번 + 다시 물음 한 번").toBe(2);
  await expect(region(page).getByRole("alert")).toHaveCount(0);
  expect(shifts.all, shifts.moved).toBe(0);
});
