// 회귀(v0.3.4 운영, PM-프론트 11-01): 시뮬레이터(COMBAT_POWER_SIM)가 꺼진 배포에서 추천 순서의
// '이 순서를 시뮬레이터에서 열기'가 보여, 누르면 없는 탭을 열려다 전투 탭으로 돌아갔다. 시뮬레이터 탭이 있을
// 때만 그 줄을 보인다. 평소 실행은 켜진 쪽(링크가 시뮬레이터 탭을 엶), 웹 서버를 COMBAT_POWER_SIM=off(또는
// SITE_URL=운영 호스트)로 띄우면 꺼진 쪽(링크도 '아직 바꿀 수 없어요' 줄도 없음)을 본다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

const site = (process.env.SITE_URL ?? "").trim().toLowerCase();
const flag = (process.env.COMBAT_POWER_SIM ?? "").trim().toLowerCase();
const off = flag === "off" || (flag !== "on" && /^https?:\/\/(www\.)?loakraken\.gg(\/|:|$)/.test(site));
const section = (page) => page.getByRole("region", { name: "추천 순서" });

test(`@flag 추천 순서의 시뮬레이터 링크: ${off ? "시뮬레이터가 꺼지면 없음" : "켜지면 시뮬레이터 탭을 엶"} @regression`, async ({ page }) => {
  await page.goto(characterPath("스펙순서", "specup"));
  await section(page).getByRole("button", { name: "추천 순서 보기" }).click();
  await expect(section(page).getByRole("list", { name: /^추천 순서, / }).getByRole("listitem")).toHaveCount(2);
  const link = section(page).getByRole("link", { name: "이 순서를 시뮬레이터에서 열기" });
  if (off) {
    await expect(page.getByRole("tab", { name: "시뮬레이터" })).toHaveCount(0);
    await expect(link).toHaveCount(0);
    await expect(section(page).getByText(/시뮬레이터에서 아직 바꿀 수 없어/)).toHaveCount(0);
    return;
  }
  await link.click();
  await expect(page.getByRole("tab", { name: "시뮬레이터" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/tab=simulator/);
});
