// 재련 기대 비용 첫 단계 진행 상황(사용자 11-02: '실패 횟수'가 헷갈림, PM 총괄 option A):
// 장인의 기운과 숨결·책 전 '현재 성공 확률'을 받고, 실패 횟수는 api가 성공 확률로 찾는다.
// 요청에 실패 횟수를 보내지 않고, 답의 횟수를 "실패 n회로 계산했어요."로 보여 준다. 맞지 않는
// 확률은 그 이유를 말한다. 목 서버: 무기 +19 기본 8.60% → 실패 1회면 9.46%.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

async function openProgress(page) {
  await page.goto("/tools/refining");
  await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
  await page.getByText("첫 단계 진행 상황 입력").click();
  return page.getByRole("listitem").filter({ hasText: "무기 +19" });
}

test("실패 횟수 칸 없이, 성공 확률을 넣으면 그 값만 보내고 api가 찾은 횟수를 보여 준다 @regression", async ({ page }) => {
  const row = await openProgress(page);
  await expect(row.getByText("실패 횟수", { exact: true })).toHaveCount(0);
  const rate = row.getByRole("spinbutton", { name: "현재 성공 확률(%)" });
  await expect(rate).toHaveAttribute("placeholder", "숨결·책 전");
  const asked = page.waitForRequest(
    (r) => r.url().includes("/api/refining/plans") && r.postDataJSON()?.currentSuccessRate === 9.46,
  );
  await rate.fill("9.46");
  const body = (await asked).postDataJSON();
  expect(body.equipmentType).toBe("WEAPON");
  expect("currentFailedAttempts" in body).toBe(false);
  await expect(row.getByText("실패 1회로 계산했어요.")).toBeVisible();
});

test("이 단계에 나올 수 없는 성공 확률이면 숨결·책 전 값을 넣으라고 말한다 @regression", async ({ page }) => {
  const row = await openProgress(page);
  await row.getByRole("spinbutton", { name: "현재 성공 확률(%)" }).fill("9.5");
  await expect(page.getByText("현재 성공 확률을 확인해 주세요")).toBeVisible();
  await expect(page.getByText(/숨결·책을 올리기 전 재련 창의 성공 확률을 넣어 주세요/)).toBeVisible();
});

test("320: '실패 n회' 줄은 처음부터 자리를 잡아, 답이 와도 아무것도 움직이지 않는다 @regression", async ({ page }) => {
  await watchShifts(page);
  await page.setViewportSize({ width: 320, height: 800 });
  // Answers come late so a shift from the arriving line would be caught (#1135).
  await page.route("**/api/refining/plans", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  const row = await openProgress(page);
  const rate = row.getByRole("spinbutton", { name: "현재 성공 확률(%)" });
  await expect(rate).toBeVisible();
  const shifts = await shiftsDuring(page, async () => {
    await rate.fill("9.46");
    await expect(row.getByText("실패 1회로 계산했어요.")).toBeVisible();
  });
  expect(shifts.all, shifts.moved).toBe(0);
  await expectNoHorizontalOverflow(page);
});
