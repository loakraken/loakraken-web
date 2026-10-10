// 회귀: 캐릭터 순위 패널(F-7, web #168·#170·#259)과 원정대 칭호(web #172·#202).
// 목 이름: 상세(순위 있음), 비공개(HIDDEN → "순위 비공개"만), 조건밖(집계 조건 밖), 집계중(표본 작음),
// 미관측(404). 칭호: 상세(기록 있음), 칭호없음(빈 기록).
// PM-프론트 #144 P2③: rankVisibility HIDDEN이면 순위 수치가 어디에도 보이면 안 된다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const rankPanel = (page) => page.getByRole("region", { name: "순위", exact: true });

test.describe("캐릭터 순위 패널 @regression", () => {
  test("순위가 있으면 지표별 순위와 티어 범례를 보여 준다", async ({ page }) => {
    await gotoReady(page, characterPath("상세"));
    const panel = rankPanel(page);
    await expect(panel.getByRole("region", { name: "전투력 순위" })).toBeVisible();
    await expect(panel.getByRole("region", { name: "아이템 레벨 순위" })).toBeVisible();
    await expect(panel).toContainText("LOAKraken 수집 기준");
    await expect(panel).toContainText("티어:");
  });

  test("비공개면 '순위 비공개'만 보이고 순위·백분위 숫자가 없다", async ({ page }) => {
    await gotoReady(page, characterPath("비공개"));
    const panel = rankPanel(page);
    await expect(panel).toContainText("순위 비공개");
    await expect(panel).not.toContainText(/상위\s*[\d.]+%|\d+위/);
    await expect(panel.getByRole("region", { name: /순위$/ })).toHaveCount(0);
  });

  test("집계 조건 밖이면 조건을 안내한다", async ({ page }) => {
    await gotoReady(page, characterPath("조건밖"));
    await expect(rankPanel(page)).toContainText("순위 집계 조건에 들지 않아요");
  });

  test("표본이 작으면 0이 아니라 '집계 중'을 보여 준다", async ({ page }) => {
    await gotoReady(page, characterPath("집계중"));
    await expect(rankPanel(page)).toContainText("집계 중");
  });

  test("아직 관측하지 않은 캐릭터는 안내한다", async ({ page }) => {
    await gotoReady(page, characterPath("미관측"));
    await expect(rankPanel(page)).toContainText("아직 순위 집계에 들어가지 않은 캐릭터예요.");
  });
});

test.describe("원정대 칭호 @regression", () => {
  test("기록된 칭호를 처음 확인한 순서로 보여 준다", async ({ page }) => {
    await gotoReady(page, characterPath("상세", "siblings"));
    const panel = page.getByRole("region", { name: "원정대 칭호" });
    await expect(panel).toContainText(/\d+개 · 원정대 \d+명 중 \d+명 기록/);
    await expect(panel).toContainText("장착한 칭호만 기록되며 실제 획득일과 다를 수 있어요");
    await expect(panel.getByRole("list").first().locator(":scope > li").first()).toContainText(/처음 확인|같은 날 확인/);
  });

  test("기록이 없으면 안내한다", async ({ page }) => {
    await gotoReady(page, characterPath("칭호없음", "siblings"));
    await expect(page.getByRole("region", { name: "원정대 칭호" })).toContainText("아직 확인한 칭호가 없어요.");
  });
});
