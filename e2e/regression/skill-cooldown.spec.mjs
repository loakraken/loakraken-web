// 회귀: 스킬 탭 보석 반영 쿨타임(백엔드 #378, 체크리스트 K20) — 보석 감소가 있으면 '24초 → 19.2초 보석 20% 감소',
// 없으면 공식 쿨타임만, 계산 근거는 '쿨타임' 툴팁. 값이 없는 스킬은 줄을 그리지 않는다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("스킬 카드에 보석 반영 쿨타임과 근거 툴팁 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "skills"));
  const gravity = page.locator("li").filter({ has: page.getByText("합성 중력", { exact: true }) }).first();
  await expect(gravity).toContainText("24초");
  await expect(gravity).toContainText("19.2초");
  await expect(gravity).toContainText("보석 20% 감소");
  const cannon = page.locator("li").filter({ has: page.getByText("합성 포격", { exact: true }) }).first();
  await expect(cannon).toContainText("18초");
  await expect(cannon).not.toContainText("감소");
  const term = gravity.getByRole("button", { name: /^쿨타임/ });
  await term.focus();
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveText("공식 재사용 대기시간과 장착 보석의 재사용 대기시간 감소만 반영했습니다.");
  // 값이 없는 스킬(기본 스킬)은 쿨타임 줄이 없다.
  const basic = page.locator("li").filter({ has: page.getByText("기본 스킬", { exact: true }) }).first();
  await expect(basic.getByRole("button", { name: /^쿨타임/ })).toHaveCount(0);
});
