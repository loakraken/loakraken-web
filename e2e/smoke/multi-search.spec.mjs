// 멀티서치(web #611, K37). 목 백엔드의 비교1…비교6은 아이템 레벨·전투력·직업이 서로 다르다
// (비교6이 가장 높고, 비교4는 전투력 미제공). 미존재는 404다.
import { test, expect, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";

const field = (page) => page.getByRole("textbox", { name: "캐릭터 이름" });
const table = (page) => page.getByRole("region", { name: "캐릭터 비교 표" });
const cards = (page) => page.getByRole("region", { name: "캐릭터 비교 카드" });
const row = (page, name) => table(page).getByRole("row").filter({ has: page.getByRole("rowheader", { name }) });

test.describe("멀티서치 @smoke", () => {
  test("이름 여러 개를 넣으면 나란히 비교하고 주소에 남는다", async ({ page }) => {
    await gotoReady(page, "/multi-search");
    await expect(page.getByRole("heading", { level: 1, name: "멀티서치" })).toBeVisible();
    await field(page).fill("비교1, 비교2 비교3");
    await page.getByRole("button", { name: "비교하기" }).click();
    await expect(page).toHaveURL(/names=%EB%B9%84%EA%B5%901%2C/);
    await expect(page.getByText("3명을 비교하고 있어요")).toBeVisible();
    const view = page.viewportSize().width > 640 ? table(page) : cards(page);
    await expect(view).toContainText("1,717.5"); // 비교3 아이템 레벨
    await expect(view).toContainText("최고");
    await expectNoHorizontalOverflow(page);
  });

  test("한 번에 한 명씩 차례로 부른다", async ({ page }) => {
    // 응답이 끝난 순서와 다음 요청이 시작된 순서를 이어서 적는다. 개발 서버의
    // StrictMode가 첫 요청을 한 번 더 냈다가 취소하는 것은 세지 않는다.
    const events = [];
    const who = (request) => new URL(request.url()).searchParams.get("characterName");
    const mine = (request) => new URL(request.url()).pathname === "/api/characters";
    page.on("request", (r) => mine(r) && events.push(`start ${who(r)}`));
    page.on("requestfinished", (r) => mine(r) && events.push(`end ${who(r)}`));
    await gotoReady(page, "/multi-search?names=비교1,비교2,비교3,비교5");
    await expect(page.getByText("4명을 비교하고 있어요")).toBeVisible();
    const names = ["비교1", "비교2", "비교3", "비교5"];
    for (let i = 1; i < names.length; i++)
      expect(events.indexOf(`start ${names[i]}`), `${names[i]}은 ${names[i - 1]}의 응답 뒤에 시작`).toBeGreaterThan(
        events.indexOf(`end ${names[i - 1]}`)
      );
  });

  test("6명을 넘거나 이름이 아니면 빼고 이유를 알린다", async ({ page }) => {
    await gotoReady(page, "/multi-search");
    await field(page).fill("비교1,비교2,비교3,비교4,비교5,비교6,가나,다라,이름!");
    await page.getByRole("button", { name: "비교하기" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "뺐어요" });
    await expect(alert).toContainText("이름!");
    await expect(alert).toContainText("가나, 다라");
    await expect(page.getByText("최대 6명까지 비교할 수 있어요. 지금 6명")).toBeVisible();
  });

  test("못 찾은 캐릭터는 이유 한 줄, 값 없는 칸도 이유를 쓴다", async ({ page }) => {
    await gotoReady(page, "/multi-search?names=비교4,미존재");
    await expect(page.getByText("2명을 비교하고 있어요")).toBeVisible();
    const view = page.viewportSize().width > 640 ? table(page) : cards(page);
    await expect(view).toContainText("캐릭터를 찾지 못했어요");
    await expect(view).toContainText("미제공"); // 비교4 전투력
    await expect(view.getByRole("button", { name: /다시 시도/ })).toHaveCount(0);
  });

  test("빼기와 정렬", async ({ page }) => {
    test.skip(page.viewportSize().width <= 640, "정렬 머리는 넓은 화면의 표에만 있다");
    await gotoReady(page, "/multi-search?names=비교1,비교3,비교2");
    await expect(page.getByText("3명을 비교하고 있어요")).toBeVisible();
    await table(page).getByRole("button", { name: "아이템 레벨" }).click();
    await expect(table(page).getByRole("rowheader").first()).toContainText("비교3");
    await row(page, /비교3/).getByRole("button", { name: "비교3 빼기" }).click();
    await expect(row(page, /비교3/)).toHaveCount(0);
    await expect(page).not.toHaveURL(/%EB%B9%84%EA%B5%903/);
    await expect(field(page)).toBeFocused();
  });
});
