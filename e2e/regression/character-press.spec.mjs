// 회귀(apple-design 재검수 · 캐릭터): 1280에서 어느 탭으로 바꿔도 흔들림 0(짧은 탭도 바닥글이
// 처음부터 화면 밖), 휴대폰에서 탭·작은 버튼은 보이는 크기 그대로 44px로 눌린다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

/** Each corner of a 44×44 box around the centre lands on the control itself. */
const pressArea = (control) =>
  control.evaluate((el) => {
    el.scrollIntoView({ block: "center", inline: "nearest" });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    return [
      [-21, -21],
      [21, -21],
      [-21, 21],
      [21, 21],
    ].map(([dx, dy]) => {
      const hit = document.elementFromPoint(x + dx, y + dy);
      return hit === el || el.contains(hit);
    });
  });

test("캐릭터: 1280 탭 전환마다 흔들림 0 @regression", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await watchShifts(page);
  await gotoReady(page, characterPath("상세"));
  await page.waitForTimeout(600);
  const nav = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
  const names = (await nav.getByRole("link").allInnerTexts()).map((n) => n.replace(/\s+/g, " ").trim());
  for (const name of [...names.slice(1), names[0]]) {
    const moved = await shiftsDuring(page, () => nav.getByRole("link", { name, exact: true }).click(), 1500);
    expect(moved.all, `${name} 탭 전환 흔들림 (${moved.moved})`).toBe(0);
  }
});

test("캐릭터: 360에서 탭·배너 순위·효율 설명·글자 버튼 누르는 영역 44px @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoReady(page, characterPath("상세"));
  const nav = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
  // Tabs: the row scrolls sideways, so check the vertical reach of the first two.
  for (const i of [0, 1]) {
    const area = await pressArea(nav.getByRole("link").nth(i));
    expect([area[0], area[2]], `탭 ${i + 1} 위·아래`).toEqual([true, true]);
  }
  expect(await pressArea(page.getByRole("button", { name: /^전투력 [\d,]+위/ })), "배너 순위").toEqual([true, true, true, true]);
  expect(await pressArea(page.getByRole("button", { name: /^팔찌 효율/ })), "팔찌 효율 설명").toEqual([true, true, true, true]);
  expect(await pressArea(page.getByRole("button", { name: "팔찌 줄별 보기" })), "팔찌 줄별 보기").toEqual([true, true, true, true]);
});

test("캐릭터: 360에서 탭 줄 끝이 더보기 버튼 아래로 들어가지 않음 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoReady(page, characterPath("상세"));
  const more = page.getByRole("button", { name: "더보기" });
  // Every point of the menu button, its left edge too, belongs to the button.
  const edge = await more.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [1, 3, r.width / 2].map((dx) => {
      const hit = document.elementFromPoint(r.left + dx, r.top + r.height / 2);
      return hit === el || el.contains(hit);
    });
  });
  expect(edge).toEqual([true, true, true]);
});
