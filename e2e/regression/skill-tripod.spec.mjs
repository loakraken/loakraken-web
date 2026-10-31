// 회귀(사용자 10-31): 스킬 탭 트라이포드 — 단계마다 1·2·3 중 몇 번째를 골랐는지(점 세 개 중 고른 것만 채움),
// 마우스를 올리거나(넓은 화면) 누르면(휴대폰) 효과 카드(이름, 'N단계 · M번째', 공식 효과 글). 효과가 없는
// 옛 캐시는 자리 줄만. 각성기·초각성 스킬은 표시(백엔드 #773 skillType, 100·101은 아직 구분 없이 '초각성'),
// 그 밖의 값이나 값이 없으면 일반 스킬. 카드를 열어도 흔들림 0, 가로 넘침 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const skillRow = (page, name) => page.locator("li").filter({ has: page.getByText(name, { exact: true }) }).first();
// The button's spoken name: the name, its level when the official armory page
// gives one (the mock serves levels when that switch is on), then the place.
const tripodLabel = (name, place) => new RegExp(`^${name}( 레벨 \\d+)?, ${place} 상세 보기$`);
const chips = (row) => row.getByRole("list", { name: "스킬 정보" }).getByRole("listitem");

test("1280: 고른 자리 점, 올리면 효과 카드, 각성기·초각성 표시 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await watchShifts(page);
  await gotoReady(page, characterPath("상세", "skills"));

  // 각성기 / 초각성 chips; a 0 and a missing type are normal skills.
  await expect(chips(skillRow(page, "합성 중력"))).toContainText(["각성기"]);
  await expect(chips(skillRow(page, "합성 화염"))).toContainText(["초각성"]);
  for (const name of ["합성 포격", "기본 스킬"])
    await expect(skillRow(page, name).getByText(/^(각성기|초각성)$/)).toHaveCount(0);

  // 연발 포격 = 2단계 2번째: the second dot filled, the place read in words.
  const cannon = skillRow(page, "합성 포격");
  // The button's label replaces its text for screen readers: the place is in it.
  const trigger = cannon.getByRole("button", { name: tripodLabel("연발 포격", "2단계 · 2번째") });
  await expect(trigger.locator("i[data-on]")).toHaveCount(1);
  expect(await trigger.locator("i").evaluateAll((dots) => dots.map((dot) => dot.hasAttribute("data-on")))).toEqual([false, true, false]);

  const shifts = await shiftsDuring(page, () => trigger.hover(), 400);
  const card = page.getByLabel("연발 포격", { exact: true });
  await expect(card).toBeVisible();
  await expect(card).toContainText("2단계 · 2번째");
  await expect(card).toContainText("포격이 2회 연속 발사된다.");
  expect(shifts.all, `카드 열 때 흔들림 (${shifts.moved})`).toBe(0);

  // An old cache without the effect: the place line only.
  await skillRow(page, "합성 화염").getByRole("button", { name: tripodLabel("장전", "1단계 · 2번째") }).hover();
  const old = page.getByLabel("장전", { exact: true });
  await expect(old).toContainText("1단계 · 2번째");
  await expectNoHorizontalOverflow(page);
});

test.describe("휴대폰", () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });

  test("360: 트라이포드를 누르면 효과 카드, 넘침 0 @regression", async ({ page }) => {
    await gotoReady(page, characterPath("상세", "skills"));
    const trigger = skillRow(page, "합성 포격").getByRole("button", { name: tripodLabel("화약 추가", "3단계 · 1번째") });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.tap();
    const sheet = page.getByRole("dialog", { name: "화약 추가" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("3단계 · 1번째");
    await expect(sheet).toContainText("포격 피해가 30.0% 증가한다.");
    await expectNoHorizontalOverflow(page);
  });
});
