// 회귀(codex on api #922): 목표 경로 계산 자리가 모두 차 있으면 api가 429 SPEC_UP_BUSY(Retry-After)를 준다. 그 뒤
// 같은 목표로 다시 누르면 다시 계산해야 한다(전에는 같은 값이라 아무 일도 없어 숫자를 바꿔야 했음). 기다리는
// 동안은 단추가 남은 초를 보이고, 몰림 안내는 요청 한도 안내와 다르다.
import { test, expect, specUpListPath } from "../support/fixtures.mjs";

test("목표 경로: 계산이 몰려 429면 기다린 뒤 같은 목표로 다시 찾는다 @regression", async ({ page }, testInfo) => {
  // The mock answers 12451.5 busy once per client address: one of its own for every worker, repeat and retry
  // (the IPv6 documentation range), so a rerun in the same mock process is busy again.
  const { workerIndex, repeatEachIndex, retry } = testInfo;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `2001:db8::${workerIndex}:${repeatEachIndex}:${retry}` });
  await page.goto(specUpListPath("전투력계산"));
  const goal = page.getByRole("region", { name: "목표 전투력" });
  await goal.getByRole("textbox", { name: "목표 전투력" }).fill("12451.5");
  await goal.getByRole("button", { name: "경로 찾기" }).click();
  await expect(goal.getByRole("alert")).toHaveText("경로를 찾는 요청이 몰려 지금은 계산하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
  // Its Retry-After (1 s) is counted on the button, then it can be pressed again.
  await expect(goal.getByRole("button", { name: "경로 찾기", exact: true })).not.toHaveAttribute("aria-disabled", "true", { timeout: 5000 });
  const asked = page.waitForRequest((request) => request.url().includes("/spec-up/goal"));
  await goal.getByRole("button", { name: "경로 찾기", exact: true }).click();
  await asked;
  await expect(goal).toContainText("9레벨 → 10레벨");
  await expect(goal.getByRole("alert")).toHaveCount(0);
});

// codex #1611 P2: during the busy answer's Retry-After the button counts down and holds: neither a press nor
// Enter sends a request until the wait is over; then one press sends exactly one.
test("목표 경로: 계산 몰림 대기 중에는 눌러도 요청하지 않고, 끝나면 한 번 요청한다 @regression", async ({ page }, testInfo) => {
  const { workerIndex, repeatEachIndex, retry } = testInfo;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `2001:db8::${workerIndex}:${repeatEachIndex}:${retry}` });
  await page.goto(specUpListPath("전투력계산"));
  const goal = page.getByRole("region", { name: "목표 전투력" });
  const field = goal.getByRole("textbox", { name: "목표 전투력" });
  await field.fill("12452.5");
  await goal.getByRole("button", { name: "경로 찾기" }).click();
  await expect(goal.getByRole("alert")).toHaveText(/요청이 몰려/);
  const button = goal.locator("form button[type=submit]");
  // The wait (3 s) shows on the button, which holds.
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).not.toHaveText("경로 찾기");
  let asked = 0;
  page.on("request", (request) => request.url().includes("/spec-up/goal") && asked++);
  // A real press on the held button (Playwright would otherwise wait for aria-disabled to clear).
  await button.click({ force: true });
  await field.press("Enter");
  await page.waitForTimeout(500);
  expect(asked, "대기 중 요청").toBe(0);
  // Then it can be pressed again: one request.
  await expect(button).toHaveText("경로 찾기", { timeout: 6000 });
  await button.click();
  await expect(goal).toContainText("9레벨 → 10레벨");
  expect(asked, "대기 뒤 요청").toBe(1);
});
