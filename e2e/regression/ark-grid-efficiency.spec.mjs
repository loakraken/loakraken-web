// 회귀: 아크 그리드 효율(백엔드 #570, 사용자 결정 — 효율 = 비교 사이트의 딜 지분) — 전투 탭 아크 그리드
// 패널 머리에 젬 옵션 + 코어 포인트 실 효율 합계와 나눔, 질서·혼돈 따로, 줄별 보기에 젬 옵션 줄마다 몫.
// 예전 전투력 기여(코어 줄 몫)는 없다. 아크 그리드가 없으면 '0% · 아크 그리드 없음', 있는데 계산 못 하면
// '준비 중'(PM-프론트 P3). 뜻 풀이(A22).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const head = (page) => page.getByRole("button", { name: /^아크 그리드 효율/ }).locator("xpath=ancestor::p[1]");

test("딜러: 합계·젬 옵션·코어 포인트, 질서·혼돈, 줄별 보기에 옵션 줄 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  const term = page.getByRole("button", { name: /^아크 그리드 효율/ });
  await expect(term).toBeVisible();
  await expect(head(page)).toContainText("+4.67%");
  await expect(head(page)).toContainText("젬 옵션 +3.21% · 코어 포인트 +1.41%");
  await term.focus();
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveText("아크 그리드 젬(옵션·코어 포인트)이 딜을 몇 % 올려 주는지예요.");
  const series = head(page).locator("xpath=following-sibling::p[1]");
  await expect(series).toContainText("질서 +2.66%");
  await expect(series).toContainText("혼돈 +1.97%");
  // The combat-power contribution per core is gone.
  await expect(page.getByText("+7.67%")).toHaveCount(0);
  await expect(page.getByText("코어 +31.74%")).toHaveCount(0);

  const toggle = head(page).getByRole("button", { name: "아크 그리드 젬 옵션 줄별 보기" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("+0.99%")).toHaveCount(0);
  await toggle.click();
  const close = head(page).getByRole("button", { name: "아크 그리드 젬 옵션 줄별 접기" });
  const lines = page.locator(`[id="${await close.getAttribute("aria-controls")}"] > li`);
  await expect(lines).toHaveCount(3);
  await expect(lines.nth(0)).toContainText("공격력 Lv.28");
  await expect(lines.nth(0)).toContainText("+0.99%");
  await expect(lines.nth(1)).toContainText("+2.10%");
  await expect(lines.nth(2)).toContainText("계산하지 않는 줄이에요.");
  await close.click();
  await expect(page.getByText("+0.99%")).toHaveCount(0);
});

test("아크 그리드가 없으면 0%, 있는데 계산 못 하면 '준비 중' @regression", async ({ page }) => {
  await gotoReady(page, characterPath("아크없음"));
  await expect(head(page)).toContainText("0% · 아크 그리드 없음");
  await gotoReady(page, characterPath("효율준비중"));
  await expect(head(page)).toContainText("준비 중");
  await expect(head(page).getByRole("button", { name: /줄별 보기$/ })).toHaveCount(0);
});
