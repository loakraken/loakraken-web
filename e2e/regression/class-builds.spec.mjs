// 회귀(M12 직업 통계): 직업 상세 — 표본·직업 전체·실제로 쓴 최소 아이템 레벨(1680)·기준 시각,
// 항목별 막대, 숨긴 칸은 한 캐릭터가 여러 칸에 드는 항목(각인·팔찌)과 보석이면 사람 수 없이.
// 직업 각인·기간 전환(누른 직후 포함) 흔들림 0, 표본이 적으면 안내, 통계 표·분석 메뉴에서 들어온다.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

const BLADE = `/stats/classes/${encodeURIComponent("블레이드")}`;

for (const width of [1280, 360])
  test(`@M12 ${width} 직업 상세: 항목·숨김 문구·조건 전환 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, BLADE);
    await expect(page.getByRole("heading", { level: 1, name: "블레이드" })).toBeVisible();
    await expect(page.getByText(/표본 880명\(장비를 확인한 캐릭터\) · 블레이드 전체 2,480명 · 아이템 레벨 1,680 이상 · 최근 30일/)).toBeVisible();
    const combos = page.getByRole("region", { name: "각인 조합" });
    await expect(combos.getByRole("listitem")).toHaveCount(2);
    await expect(combos).toContainText("표본이 적은 항목 31명은 숨김");
    // Several cells per character: no people in the hidden line.
    const engravings = page.getByRole("region", { name: "각인 채용률" });
    await expect(engravings).toContainText("표본이 적은 항목은 숨김");
    await expect(engravings).not.toContainText(/숨김.*명|명은 숨김/);
    await expect(page.getByRole("region", { name: "팔찌 전투 특성" })).toContainText("팔찌를 못 읽은 7명 제외");
    await expect(page.getByRole("region", { name: "팔찌 전투 특성" })).not.toContainText("명은 숨김");
    await expect(page.getByRole("region", { name: "피해 증가 보석" })).toContainText("표본이 적은 항목은 숨김");
    await expect(page.getByRole("region", { name: "주력 전투 특성" })).toContainText("4명은 치명→특화→신속→제압→인내→숙련 순으로");
    await page.waitForTimeout(600);
    expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);

    const classEngraving = page.getByRole("group", { name: "직업 각인" });
    const moved = await shiftsDuring(page, () => classEngraving.getByRole("button", { name: "잔재된 기운" }).click());
    await expect(page).toHaveURL(/classEngraving=/);
    await expect(page.getByText(/표본 640명/)).toBeVisible();
    expect(moved.all, `직업 각인 전환 흔들림 (${moved.moved})`).toBe(0);
    const days = await shiftsDuring(page, () => page.getByRole("group", { name: "최근 확인" }).getByRole("button", { name: "7일" }).click());
    await expect(page.getByText(/표본 320명/)).toBeVisible();
    expect(days.all, `기간 전환 흔들림 (${days.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

test("@M12 표본이 적은 직업은 안내만 @regression", async ({ page }) => {
  await gotoReady(page, `/stats/classes/${encodeURIComponent("기상술사")}`);
  await expect(page.getByText("아직 표본이 12명이라 보여 드리지 않아요.")).toBeVisible();
  await expect(page.getByText(/표본 30명이 모이면 보여 드려요/)).toBeVisible();
  await expect(page.getByRole("region", { name: "각인 조합" })).toHaveCount(0);
});

test("@M12 통계 직업 표와 캐릭터 분석 메뉴에서 직업 상세로 @regression", async ({ page }) => {
  await gotoReady(page, "/stats");
  await page.getByRole("link", { name: "블레이드", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${BLADE}$`));
  await expect(page.getByRole("heading", { level: 1, name: "블레이드" })).toBeVisible();

  await gotoReady(page, characterPath("상세"));
  await page.getByRole("button", { name: /^분석/ }).click();
  const link = page.getByRole("menuitem", { name: /^직업 통계/ });
  await expect(link).toHaveAttribute("href", /^\/stats\/classes\//);
});
