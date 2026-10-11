// 회귀: 팔찌 효율(백엔드 #350) — 전투 탭 팔찌 줄에 '팔찌 효율 +14.42%'와 뜻 풀이, 줄별 기여 펼치기.
// 계산하지 않는 줄·서포터는 이유 문장을 화면에 보인다(회귀 점검표 A21·A22).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("딜러: 팔찌 효율 합계와 줄별 기여, 계산하지 않는 줄의 이유 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  const term = page.getByRole("button", { name: /^팔찌 효율/ });
  await expect(term).toBeVisible();
  await expect(page.getByText("+14.42%")).toBeVisible();
  await term.focus();
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveText("이 팔찌가 전투력을 몇 % 올려 주는지예요.");

  const toggle = page.getByRole("button", { name: "줄별 보기" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(page.getByRole("button", { name: "줄별 접기" })).toHaveAttribute("aria-expanded", "true");
  const lines = page.locator(`[id="${await page.getByRole("button", { name: "줄별 접기" }).getAttribute("aria-controls")}"]`);
  await expect(lines.getByRole("listitem")).toHaveCount(3);
  await expect(lines.getByRole("listitem").nth(0)).toContainText("+4.12%");
  await expect(lines.getByRole("listitem").nth(1)).toContainText("속도는 전투력에 들어가지 않아요.");
  await expect(lines.getByRole("listitem").nth(2)).toContainText("팔찌 도약 +18");
  await expect(lines.getByRole("listitem").nth(2)).toContainText("+2.05%");
});

test("서포터: 값 대신 계산하지 않는 이유 한 줄, 줄별 보기 없음 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세서포터"));
  await expect(page.getByText("서포터는 전투력이 딜러와 다르게 계산돼 팔찌 효율을 매기지 않아요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "줄별 보기" })).toHaveCount(0);
});
