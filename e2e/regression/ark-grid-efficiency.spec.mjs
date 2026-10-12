// 회귀: 아크 그리드 효율(백엔드 #424) — 전투 탭 아크 그리드 패널 머리에 '아크 그리드 효율 +37.36%'와
// 코어만의 합, 뜻 풀이. 줄별 보기를 펼치면 코어 줄마다 몫이 붙고 끝에 젬 옵션 줄이 붙는다.
// 전투력이 바뀌지 않는 코어·계산하지 않는 코어·서포터는 이유 문장을 화면에 보인다(회귀 점검표 A21·A22).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("딜러: 전체·코어 합계, 코어 줄별 몫과 젬 옵션 줄, 이유 문장 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  const term = page.getByRole("button", { name: /^아크 그리드 효율/ });
  await expect(term).toBeVisible();
  const head = term.locator("xpath=ancestor::p[1]");
  await expect(head).toContainText("+37.36%");
  await expect(head).toContainText("코어 +31.74%");
  await term.focus();
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveText("코어와 젬 옵션이 전투력을 몇 % 올려 주는지예요.");

  const toggle = head.getByRole("button", { name: "줄별 보기" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // 펼치기 전에는 몫이 없다
  await expect(page.getByText("+7.67%")).toHaveCount(0);
  await toggle.click();
  const close = head.getByRole("button", { name: "줄별 접기" });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  const cores = page.locator(`[id="${await close.getAttribute("aria-controls")}"] > li`);
  await expect(cores).toHaveCount(6);
  await expect(cores.nth(0)).toContainText("+7.67%");
  await expect(cores.nth(3)).toContainText("전투력이 바뀌지 않는 코어예요.");
  await expect(cores.nth(4)).toContainText("아직 계산식이 없는 코어예요.");
  await expect(cores.nth(5)).toContainText("+2.50%");
  await expect(page.getByText("젬 옵션(공격력 Lv.28 · 추가 피해 Lv.51 · 보스 피해 Lv.4)")).toBeVisible();
  await expect(page.getByText("+4.27%")).toBeVisible();

  await close.click();
  await expect(page.getByText("+7.67%")).toHaveCount(0);
  await expect(page.getByText("+4.27%")).toHaveCount(0);
});

test("서포터: 값 대신 계산하지 않는 이유 한 줄, 줄별 보기 없음 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세서포터"));
  await expect(page.getByText("서포터는 전투력이 딜러와 다르게 계산돼 아크 그리드 효율을 매기지 않아요.")).toBeVisible();
  const head = page.getByRole("button", { name: /^아크 그리드 효율/ }).locator("xpath=ancestor::p[1]");
  await expect(head.getByRole("button", { name: "줄별 보기" })).toHaveCount(0);
});
