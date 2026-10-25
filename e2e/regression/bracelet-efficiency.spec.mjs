// 회귀: 팔찌 효율(백엔드 #571, 사용자 결정 — 효율 = 비교 사이트의 딜 지분) — 전투 탭 팔찌 줄에 실 효율과
// 뜻 풀이, 딜러는 '악마 피해' 설정(기본 꺼짐)을 켜면 그 값. 서포터는 등급만(% 없음, PM-프론트), 계산 못 하면
// '준비 중'. 예전 줄별 전투력 기여는 없다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const term = (page) => page.getByRole("button", { name: /^팔찌 효율/ });

test("딜러: 실 효율, '악마 피해'를 켜면 그 값, 줄별 기여 없음 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  await expect(term(page)).toBeVisible();
  const head = term(page).locator("xpath=ancestor::p[1]");
  await expect(head).toContainText("+11.30%");
  await term(page).focus();
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveText("이 팔찌가 딜을 몇 % 올려 주는지예요.");
  const devil = head.getByRole("button", { name: "악마 피해" });
  await expect(devil).toHaveAttribute("aria-pressed", "false");
  await devil.click();
  await expect(devil).toHaveAttribute("aria-pressed", "true");
  await expect(head).toContainText("+14.08%");
  await expect(head).not.toContainText("+11.30%");
  await devil.click();
  await expect(head).toContainText("+11.30%");
  await expect(head.getByRole("button", { name: /줄별 보기$/ })).toHaveCount(0);
  // The old per-line contribution (+4.12% on 치명타 피해) is gone from the bracelet.
  await expect(term(page).locator("xpath=ancestor::div[1]")).not.toContainText("+4.12%");
});

test("서포터는 등급만(% 없음), 계산 못 하면 '준비 중'(숫자 없음) @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세서포터"));
  await expect(page.getByText("팔찌", { exact: true }).first()).toBeVisible();
  await expect(term(page)).toHaveCount(0);
  await expect(page.getByText("+13.48%")).toHaveCount(0);
  await gotoReady(page, characterPath("효율준비중"));
  await expect(term(page).locator("xpath=ancestor::p[1]")).toContainText("준비 중");
  await expect(term(page).locator("xpath=ancestor::p[1]")).not.toContainText("%");
});

// api #706: an option the engine cannot read gives UNAVAILABLE. The row says why
// in a fixed sentence, not '준비 중' (which reads as 'coming soon'), and no number
// or backend log text (PM-프론트 P3). 320·1280.
for (const width of [320, 1280])
  test(`읽지 못한 팔찌 옵션이면 이유 한 줄(준비 중 아님) ${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("팔찌못읽음"));
    const head = term(page).locator("xpath=ancestor::p[1]");
    await expect(head).toContainText("읽지 못한 팔찌 옵션이 있어 계산하지 않았어요");
    await expect(head).not.toContainText("준비 중");
    await expect(head).not.toContainText("%");
    await expect(head).not.toContainText("로그용 문장");
  });
