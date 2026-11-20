// 회귀(#1852, PM 총괄 11-21 성능 점검): 정렬 칩 · '작열 보석 포함'을 누르면 새 목록은 전환으로 그려지지만, 누른 상태와
// 정렬 막대는 누른 그 그림에 바뀐다. 새 답을 붙잡아 두고(아직 오지 않은 동안) 본다:
// - 누른 칩만 눌림, 막대(작열 보석 버튼)가 크라켄 점수에 맞게 보이고, 목록은 앞 답 그대로 + '새 순서로 다시 불러오고 있어요…'.
// - 답을 놓으면 새 목록(표 이름), 칩은 그대로. 받아 둔 정렬로 돌아가면 바로 그 목록.
import { test, expect, characterPath } from "../support/fixtures.mjs";

const chip = (page, name) => page.getByRole("button", { name, exact: true }).first();

/** Holds the list answers whose query matches `test` until the returned release() is called. */
async function hold(page, test) {
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route(/\/api\/characters\/spec-up\?/, async (route) => {
    if (test(new URL(route.request().url()).searchParams)) await gate;
    await route.continue();
  });
  return release;
}

for (const width of [320, 1280])
  test(`${width}: 정렬 · 작열 보석 버튼은 누른 그림에 눌리고, 새 목록은 답이 온 뒤 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${characterPath("실목록2", "specup")}&sort=DELTA`);
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    await table.locator("tbody tr").first().waitFor();
    await expect(page.getByRole("table", { name: /전투력 증가 순/ })).toBeVisible();
    const cooldown = page.getByRole("button", { name: "작열 보석 포함" });
    await expect(cooldown).toBeHidden(); // visibility: hidden off 크라켄 점수 (room kept)

    // 1. 크라켄 점수, answer held.
    let release = await hold(page, (q) => q.get("sort") === "KRAKEN" && q.get("includeCooldownGems") === "false");
    await chip(page, "크라켄 / 10만G").click();
    await expect(chip(page, "크라켄 / 10만G")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "전투력 증가")).toHaveAttribute("aria-pressed", "false");
    await expect(cooldown).toBeVisible();
    await expect(page.getByText("새 순서로 다시 불러오고 있어요…")).toBeVisible();
    await expect(page.getByRole("table", { name: /전투력 증가 순/ })).toBeVisible(); // the list before, until the answer
    await expect(page).toHaveURL(/sort=KRAKEN/);
    release();
    await expect(page.getByRole("table", { name: /크라켄 점수 \(10만G당\)/ })).toBeVisible();
    await expect(chip(page, "크라켄 / 10만G")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("새 순서로 다시 불러오고 있어요…")).toHaveCount(0);

    // 2. 작열 보석 포함, answer held.
    release = await hold(page, (q) => q.get("sort") === "KRAKEN" && q.get("includeCooldownGems") === "true");
    await cooldown.click();
    await expect(cooldown).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("새 순서로 다시 불러오고 있어요…")).toBeVisible();
    release();
    await expect(page.getByText("새 순서로 다시 불러오고 있어요…")).toHaveCount(0);
    await expect(cooldown).toHaveAttribute("aria-pressed", "true");

    // 3. Back to the list already in hand: its table at once, the bar off 크라켄 점수.
    await chip(page, "전투력 증가").click();
    await expect(chip(page, "전투력 증가")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("table", { name: /전투력 증가 순/ })).toBeVisible();
    await expect(cooldown).toBeHidden();
  });
