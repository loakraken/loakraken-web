// 회귀(캐릭터 화면 전수표 §14.1 ⑤): 배너 숫자 줄 아래 전투력 순위(티어·전체 순위).
// 순위 패널과 같은 조회 하나, 순위가 없으면 빈 줄(0·추정 없음), 도착해도 배너가 흔들리지 않는다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("배너 순위: 티어와 전체 전투력 순위, 공식 순위 아님 안내 @regression", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/characters/rank")) requests.push(request.url());
  });
  await gotoReady(page, characterPath("상세"));
  const banner = page.getByRole("region", { name: "상세 캐릭터 요약" });
  const badge = banner.getByRole("button", { name: /전투력 4,120위 · 상위 22\.6%/ });
  await expect(badge).toContainText("대양");
  await expect(badge).toHaveAccessibleName(/공식 순위가 아니에요/);
  // The 순위 panel on the same tab reads the same answer: never a second request.
  await expect(page.getByText("4,120위").first()).toBeVisible();
  expect(requests.length).toBeLessThanOrEqual(1);
});

test("배너 순위: 순위가 없으면 빈 줄로 자리만 @regression", async ({ page }) => {
  for (const name of ["조건밖", "미관측"]) {
    await gotoReady(page, characterPath(name));
    const banner = page.getByRole("region", { name: `${name} 캐릭터 요약` });
    await expect(banner.getByRole("button", { name: /전투력 .*위/ })).toHaveCount(0);
    await expect(banner.locator("p[class*=bannerRank]")).toHaveCount(1);
  }
});
