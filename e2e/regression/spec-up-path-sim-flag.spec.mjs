// 회귀(v0.3.4 운영, PM-프론트 11-01): 시뮬레이터(COMBAT_POWER_SIM)가 꺼진 배포에서 추천 순서 · 목표 경로 · 목록의 시뮬레이터 링크가 보였다. 추천 순서의
// '이 순서를 시뮬레이터에서 열기'가 보여, 누르면 없는 탭을 열려다 전투 탭으로 돌아갔다. 시뮬레이터 탭이 있을
// 때만 그 줄을 보인다. 평소 실행은 켜진 쪽(링크가 시뮬레이터 탭을 엶), 웹 서버를 COMBAT_POWER_SIM=off(또는
// SITE_URL=운영 호스트)로 띄우면 꺼진 쪽(링크도 '아직 바꿀 수 없어요' 줄도 없음)을 본다.
import { test, expect, characterPath, specUpListPath } from "../support/fixtures.mjs";

const site = (process.env.SITE_URL ?? "").trim().toLowerCase();
const flag = (process.env.COMBAT_POWER_SIM ?? "").trim().toLowerCase();
const off = flag === "off" || (flag !== "on" && /^https?:\/\/(www\.)?loakraken\.gg(\/|:|$)/.test(site));
test(`@flag 추천 순서의 시뮬레이터 링크: ${off ? "시뮬레이터가 꺼지면 없음" : "켜지면 시뮬레이터 탭을 엶"} @regression`, async ({ page }) => {
  // 추천 순서 is the tab's first view since 11-02 (layout A): no button to press.
  await page.goto(characterPath("스펙순서", "specup"));
  await expect(page.getByRole("table", { name: /^추천 순서, / })).toBeVisible();
  const link = page.getByRole("link", { name: "이 순서를 시뮬레이터에서 열기" });
  if (off) {
    // Character tabs are links; the simulator one is not drawn at all.
    await expect(page.getByRole("link", { name: "시뮬레이터", exact: true })).toHaveCount(0);
    await expect(link).toHaveCount(0);
    await expect(page.getByText(/시뮬레이터에서 아직 바꿀 수 없어/)).toHaveCount(0);
    return;
  }
  await link.click();
  await expect(page.getByRole("link", { name: "시뮬레이터", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/tab=simulator/);
});

// The same gate on the two other ways into the simulator (codex on #1261).
test(`@flag 목표 경로의 시뮬레이터 링크: ${off ? "꺼지면 없음" : "켜지면 시뮬레이터 탭을 엶"} @regression`, async ({ page }) => {
  await page.goto(specUpListPath("전투력계산"));
  const goal = page.getByRole("region", { name: "목표 전투력" });
  await goal.getByRole("textbox", { name: "목표 전투력" }).fill("12450");
  await goal.getByRole("button", { name: "경로 찾기" }).click();
  await expect(goal).toContainText("9레벨 → 10레벨");
  const link = goal.getByRole("link", { name: "이 경로를 시뮬레이터에서 열기" });
  if (off) {
    await expect(link).toHaveCount(0);
    await expect(goal.getByText(/시뮬레이터에서 아직 바꿀 수 없어/)).toHaveCount(0);
    return;
  }
  await link.click();
  await expect(page.getByRole("link", { name: "시뮬레이터", exact: true })).toHaveAttribute("aria-current", "page");
});

test(`@flag 목록의 적용해 보기: ${off ? "꺼지면 없음" : "켜지면 있음"} @regression`, async ({ page }) => {
  await page.goto(specUpListPath("전투력계산"));
  const table = page.getByRole("table", { name: /스펙업 후보/ });
  await expect(table.getByRole("row").nth(1)).toBeVisible();
  const tries = table.getByRole("link", { name: /시뮬레이터에서 적용해 보기/ });
  if (off) {
    await expect(tries).toHaveCount(0);
    return;
  }
  await expect(tries.first()).toBeVisible();
  await tries.first().click();
  await expect(page.getByRole("link", { name: "시뮬레이터", exact: true })).toHaveAttribute("aria-current", "page");
});
