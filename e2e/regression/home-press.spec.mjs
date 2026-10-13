// 회귀(apple-design 재검수 · 홈·일정·뉴스): 휴대폰에서 작은 버튼·링크는 보이는 크기 그대로
// 44px로 눌리고 이웃을 잡지 않는다(분류 칩·지난 회차 숨김·보상 더 보기·카드의 더보기 링크).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** Each corner of a 44×44 box around the centre lands on the control itself. */
const pressArea = (control) =>
  control.evaluate((el) => {
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

async function expectArea(locator, label) {
  // In the middle of the screen, so no corner falls outside the viewport.
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  expect(await pressArea(locator), label).toEqual([true, true, true, true]);
}

test.beforeEach(async ({ page }) => page.setViewportSize({ width: 360, height: 800 }));

test("뉴스: 분류 칩 누르는 영역 44px, 줄이 감겨도 겹치지 않음 @regression", async ({ page }) => {
  await gotoReady(page, "/news");
  const chips = page.getByRole("group", { name: "공지 분류" }).getByRole("button");
  const count = await chips.count();
  for (let i = 0; i < count; i++) await expectArea(chips.nth(i), `분류 칩 ${i + 1}`);
});

test("일정: 지난 회차 숨김·보상 더 보기 누르는 영역 44px @regression", async ({ page }) => {
  await gotoReady(page, "/schedule");
  await expectArea(page.getByRole("button", { name: "지난 회차 숨김" }), "지난 회차 숨김");
  const more = page.getByRole("button", { name: /보상 \d+개 더 보기$/ });
  await expectArea(more.first(), "보상 더 보기");
});

test("홈: 카드의 더보기 링크 누르는 영역 44px @regression", async ({ page }) => {
  await gotoReady(page, "/");
  for (const name of [/^전체 보기/, /^시세 더보기/, /^통계 더보기/]) await expectArea(page.getByRole("link", { name }).first(), String(name));
});

test("일정: 요일 버튼 누르는 영역 44px, 이웃 요일을 잡지 않음 @regression", async ({ page }) => {
  await gotoReady(page, "/schedule");
  const days = page.getByRole("group", { name: "요일 선택" }).getByRole("button");
  const count = await days.count();
  for (let i = 0; i < count; i++) await expectArea(days.nth(i), `요일 ${i + 1}`);
});
