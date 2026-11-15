// 회귀(codex on api #922, PM 총괄 11-16 after api #989): 계산 자리가 없으면 api가 429 SPEC_UP_BUSY(Retry-After)를 준다.
// 이 클라이언트의 앞 계산이 아직 자리를 쥔 경우(목표를 바꿔 다시 누름)가 흔하므로, 웹은 Retry-After 뒤 몇 번 다시
// 묻고 그래도 몰리면 그때 안내한다. 안내 뒤 기다리는 동안은 단추가 남은 초를 보이고, 같은 목표로 다시 누르면 다시
// 계산한다(전에는 같은 값이라 아무 일도 없어 숫자를 바꿔야 했음). 몰림 안내는 요청 한도 안내와 다르다.
import { test, expect, specUpListPath } from "../support/fixtures.mjs";

/** The mock counts busy answers per client address: one of its own for every worker, repeat and retry. */
const ownClient = (page, { workerIndex, repeatEachIndex, retry }) =>
  page.setExtraHTTPHeaders({ "x-forwarded-for": `2001:db8::${workerIndex}:${repeatEachIndex}:${retry}` });

test("목표 경로: 한 번 몰리면 안내 없이 기다렸다가 다시 물어 답을 보인다 @regression", async ({ page }, testInfo) => {
  await ownClient(page, testInfo);
  await page.goto(specUpListPath("전투력계산"));
  const goal = page.getByRole("region", { name: "목표 전투력" });
  let asked = 0;
  page.on("request", (request) => request.url().includes("/spec-up/goal") && asked++);
  // 12451.5 is busy once (Retry-After 1 s).
  await goal.getByRole("textbox", { name: "목표 전투력" }).fill("12451.5");
  await goal.getByRole("button", { name: "경로 찾기" }).click();
  await expect(goal).toContainText("9레벨 → 10레벨", { timeout: 10_000 });
  await expect(goal.getByRole("alert")).toHaveCount(0);
  expect(asked, "몰림 한 번 + 다시 물음 한 번").toBe(2);
});

// codex #1611 P2: once the notice shows, the button counts the Retry-After down and holds: neither a press nor
// Enter sends a request until the wait is over; then one press sends exactly one.
test("목표 경로: 계속 몰리면 안내, 대기 중에는 눌러도 요청하지 않고, 끝나면 한 번 요청한다 @regression", async ({ page }, testInfo) => {
  test.slow();
  await ownClient(page, testInfo);
  await page.goto(specUpListPath("전투력계산"));
  const goal = page.getByRole("region", { name: "목표 전투력" });
  const field = goal.getByRole("textbox", { name: "목표 전투력" });
  let asked = 0;
  page.on("request", (request) => request.url().includes("/spec-up/goal") && asked++);
  // 12452.5 is busy four times (Retry-After 2 s): the first ask and the web's three retries.
  await field.fill("12452.5");
  await goal.getByRole("button", { name: "경로 찾기" }).click();
  await expect(goal.getByRole("alert")).toHaveText("경로를 찾는 요청이 몰려 지금은 계산하지 못했어요. 잠시 뒤 다시 눌러 주세요.", { timeout: 15_000 });
  expect(asked, "처음 + 다시 물음 3번").toBe(4);
  const button = goal.locator("form button[type=submit]");
  // The last wait (2 s) shows on the button, which holds.
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).not.toHaveText("경로 찾기");
  // A real press on the held button (Playwright would otherwise wait for aria-disabled to clear).
  await button.click({ force: true });
  await field.press("Enter");
  expect(asked, "대기 중 요청").toBe(4);
  // Then the same target can be asked again: one request, and the answer.
  await expect(button).toHaveText("경로 찾기", { timeout: 6000 });
  await button.click();
  await expect(goal).toContainText("9레벨 → 10레벨");
  await expect(goal.getByRole("alert")).toHaveCount(0);
  expect(asked, "대기 뒤 요청").toBe(5);
});
