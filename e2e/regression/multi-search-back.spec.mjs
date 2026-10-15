// 회귀(사용자 지적 10-16): 멀티서치에서 이름을 넣고 캐릭터 화면에 갔다가 뒤로 오면 명단이 비어 있었다
// (뒤로 가기 때 라우터가 이름 없던 첫 화면을 되살리고, 그 빈 명단이 주소의 ?names=까지 지움).
// 뒤로 가기·새로고침·메뉴로 다시 들어오기 모두 같은 명단, 이미 받은 결과는 다시 묻지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const status = (page) => page.locator("main").getByText(/명을 (비교하고 있어요|불러왔어요)$/);

test("멀티서치: 캐릭터 화면에서 뒤로 와도, 새로고침해도, 다시 들어와도 같은 명단 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const asked = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname === "/api/characters") asked.push(url.searchParams.get("characterName"));
  });
  await gotoReady(page, "/multi-search");
  await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("비교1, 비교2 비교3");
  await page.getByRole("button", { name: "비교하기" }).click();
  await expect(status(page)).toHaveText("3명을 비교하고 있어요");
  const table = page.getByRole("region", { name: "캐릭터 비교 표" });

  // Name → character page → back: the list, the address and the results stay, with no new request.
  await table.getByRole("link", { name: "비교1" }).click();
  await expect(page).toHaveURL(/\/character\/%EB%B9%84%EA%B5%901$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const before = asked.length;
  await page.goBack();
  await expect(page).toHaveURL(/\/multi-search\?names=%EB%B9%84%EA%B5%901%2C%EB%B9%84%EA%B5%902%2C%EB%B9%84%EA%B5%903$/);
  await expect(status(page)).toHaveText("3명을 비교하고 있어요");
  await expect(table.getByRole("rowheader")).toHaveCount(3);
  await expect(table).toContainText("1,717.5"); // 비교3 아이템 레벨
  await page.waitForTimeout(500);
  expect(asked.slice(before), "뒤로 온 뒤 새 캐릭터 요청").toEqual([]);

  // Reload keeps it (the address).
  await page.reload();
  await expect(status(page)).toHaveText("3명을 비교하고 있어요");

  // Opened again without names (menu): the last list of this browser, said so.
  await gotoReady(page, "/multi-search");
  await expect(page).toHaveURL(/names=%EB%B9%84%EA%B5%901%2C%EB%B9%84%EA%B5%902%2C%EB%B9%84%EA%B5%903$/);
  await expect(status(page)).toHaveText("지난번 명단 · 3명을 비교하고 있어요");

  // Clearing forgets it: opened again, nothing comes back.
  await page.getByRole("button", { name: "모두 지우기" }).click();
  await expect(page.getByText("비교할 캐릭터를 넣어 주세요")).toBeVisible();
  await expect(page).toHaveURL(/\/multi-search$/);
  await gotoReady(page, "/multi-search");
  await page.waitForTimeout(300);
  await expect(page.getByText("비교할 캐릭터를 넣어 주세요")).toBeVisible();
  await expect(page).toHaveURL(/\/multi-search$/);
});
