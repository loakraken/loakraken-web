// 회귀(움직임 규칙 10-31, /stats #1184에 이어): 차트는 한 페이지 방문에 한 번만 그려진다.
// - 캐릭터 화면: 통계 탭의 기록 선은 처음 볼 때만 그려지고, 다른 탭에 갔다 오면 그려진 채로 있다.
// - 시세: 품목 추이 차트는 처음 한 번 그려지고, 기간(1시간·7일·14일)이나 품목을 바꾸면 그려진 채로 나온다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

/** Draw/grow parts inside `root` and how many of their transitions run now. */
const parts = (root) =>
  root.evaluate((el) => {
    const list = [...el.querySelectorAll(".k-draw, .k-grow, .k-grow-x")];
    return {
      count: list.length,
      running: list.reduce((n, part) => n + part.getAnimations().filter((a) => a.playState === "running").length, 0),
    };
  });

/** The first showing draws (something runs), then everything comes to rest. */
async function drawsThenRests(root) {
  await expect.poll(async () => (await parts(root)).count).toBeGreaterThan(0);
  await expect.poll(async () => (await parts(root)).running, { timeout: 3000 }).toBe(0);
}

/** Shown again: the parts are there and nothing is drawing, from the first look. */
async function standsDrawn(root, what) {
  await expect.poll(async () => (await parts(root)).count).toBeGreaterThan(0);
  expect((await parts(root)).running, `${what}: 다시 그려짐`).toBe(0);
}

test("캐릭터 화면 통계 탭: 다른 탭에 갔다 오면 기록 선이 다시 그려지지 않는다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, characterPath("상세", "stats"));
  const panel = page.locator("main");
  await drawsThenRests(panel);
  const tabs = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
  await tabs.getByRole("link", { name: "스킬", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=skills$/);
  await tabs.getByRole("link", { name: "통계", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=stats$/);
  await standsDrawn(panel, "통계 탭으로 돌아옴");
});

test("시세: 처음 한 번 그린 뒤 기간·품목을 바꾸면 그려진 채로 나온다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  // The item's own panel (the board beside it is a region named '… 시세' too).
  const detail = page.locator("section").filter({ has: page.getByRole("heading", { name: "시세 추이" }) });
  await drawsThenRests(detail);
  // 1시간 swaps the day chart out; 14일 brings a new day chart in.
  const ranges = detail.getByRole("group", { name: "기간" });
  await ranges.getByRole("button", { name: "1시간" }).click();
  await ranges.getByRole("button", { name: "14일" }).click();
  await standsDrawn(detail, "기간을 바꿨다 돌아옴");
  const name = await detail.getAttribute("aria-label");
  await page.getByRole("region", { name: /각인서 시세/ }).getByRole("listitem").nth(1).getByRole("button").first().click();
  await expect(detail).not.toHaveAttribute("aria-label", name);
  await standsDrawn(detail, "다른 품목");
});
