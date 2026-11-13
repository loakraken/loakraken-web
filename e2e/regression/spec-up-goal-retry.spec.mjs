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
