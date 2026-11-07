// 회귀(사용자 11-08): 멀티서치 지난번 명단은 우리 사이트 탭이 하나라도 열려 있는 동안 남는다. 다른
// 화면에 갔다가 메뉴로 돌아와도, 새 탭을 열어도 같은 명단(열린 탭이 답함). 한 탭에서 지우면 다른
// 탭에서도 지워지고, 탭을 모두 닫은 뒤 새로 열면 비어 있다. 예전에 브라우저에 남겨 둔 명단
// (localStorage)은 다시 나오지 않고 지워진다. 쿠키는 쓰지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince } from "../support/shifts.mjs";

const KEY = "loakraken:multi-search";
const status = (page) => page.locator("main").getByText(/명을 (비교하고 있어요|불러왔어요)$/);
// No list: the form says 0 at every width (the empty panel itself is the table view, hidden on phones).
const empty = (page) => page.getByText(/지금 0명$/);
const stored = (page) => page.evaluate((key) => [sessionStorage.getItem(key), localStorage.getItem(key)], KEY);

// Another tab of the same browser: its own session storage, nothing carried over.
async function newTab(context, width) {
  const tab = await context.newPage();
  await tab.route((url) => !["localhost", "127.0.0.1"].includes(url.hostname), (route) => route.abort());
  await tab.setViewportSize({ width, height: 900 });
  return tab;
}

async function compareThree(page) {
  await gotoReady(page, "/multi-search");
  await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("비교1, 비교2 비교3");
  await page.getByRole("button", { name: "비교하기" }).click();
  await expect(status(page)).toHaveText("3명을 비교하고 있어요");
}

test("멀티서치: 다른 화면에 갔다 와도 같은 명단, 쿠키 없음 @regression", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await compareThree(page);
  await gotoReady(page, "/rankings");
  await gotoReady(page, "/multi-search");
  await expect(status(page)).toHaveText("지난번 명단 · 3명을 비교하고 있어요");
  expect(await stored(page)).toEqual(["비교1,비교2,비교3", null]);
  expect(await context.cookies(), "쿠키 없음").toEqual([]);
});

for (const width of [390, 1280])
  test(`멀티서치 ${width}: 열린 탭끼리 같은 명단, 모두 닫으면 비어 있음 @regression`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    await compareThree(page);
    // The first tab moves on to another page of the site; it still answers.
    await gotoReady(page, "/rankings");

    // A second tab opened on the menu: the open tab's list, with no shift when it arrives.
    const second = await newTab(context, width);
    await watchShifts(second);
    await gotoReady(second, "/multi-search");
    await expect(status(second)).toHaveText("지난번 명단 · 3명을 비교하고 있어요");
    await expect(second).toHaveURL(/names=%EB%B9%84%EA%B5%901%2C%EB%B9%84%EA%B5%902%2C%EB%B9%84%EA%B5%903$/);
    await second.waitForTimeout(800); // proving a negative: no late shift after the list arrived
    const shift = await shiftsSince(second);
    expect(shift.all, `명단이 온 뒤 흔들림 (${shift.moved})`).toBe(0);

    // A change in one tab reaches the other: clearing here clears there too.
    await second.getByRole("button", { name: "모두 지우기" }).click();
    await expect(empty(second)).toBeVisible();
    await expect.poll(() => stored(page)).toEqual([null, null]);

    // Compare again, then close every tab of the site: a new one starts empty.
    await compareThree(second);
    await expect.poll(() => stored(page)).toEqual(["비교1,비교2,비교3", null]);
    await second.close();
    await page.close();
    const fresh = await newTab(context, width);
    await gotoReady(fresh, "/multi-search");
    await fresh.waitForTimeout(400); // longer than the 150 ms the tabs get to answer
    await expect(empty(fresh)).toBeVisible();
    await expect(fresh).toHaveURL(/\/multi-search$/);
    await fresh.close();
  });

test("멀티서치: 예전에 브라우저에 남긴 명단은 나오지 않고 지워진다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Saved per browser before 11-08 (localStorage), there before the page's own code runs.
  await page.addInitScript((key) => localStorage.setItem(key, "비교1,비교2"), KEY);
  await gotoReady(page, "/multi-search");
  await page.waitForTimeout(400); // proving a negative: no list comes back after the restore runs
  await expect(empty(page)).toBeVisible();
  await expect(page).toHaveURL(/\/multi-search$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
});
