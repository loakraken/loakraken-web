// 회귀(사용자 10-31, 11-01): 스킬 탭 트라이포드 — 단계마다 1·2·3 중 몇 번째를 골랐는지(숫자 하나, 점 대신),
// 마우스를 올리거나(넓은 화면) 누르면(휴대폰) 효과 카드(이름, 'N단계 · M번째', 공식 효과 글). 효과가 없는
// 옛 캐시는 자리 줄만. 스킬 종류 표시(백엔드 #773 skillType, 실제 원본 기준): 100 각성기, 101 초각성기,
// 1 초각성 스킬, 그 밖의 값이나 값이 없으면 일반 스킬. 카드를 열어도 흔들림 0, 가로 넘침 0.
// 핫픽스 v0.3.5.1: 각성기·초각성기는 둘 다 목록에 오고 장착한 쪽을 알 수 없어 기본 목록에서 빼고
// '전체 스킬 보기'에서만 보인다. 초각성 스킬은 일반 규칙.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const skillRow = (page, name) => page.locator("li").filter({ has: page.getByText(name, { exact: true }) }).first();
// The button's spoken name: the name, its level when the official armory page
// gives one (the mock serves levels when that switch is on), then the place.
const tripodLabel = (name, place) => new RegExp(`^${name}( 레벨 \\d+)?, ${place} 상세 보기$`);
const chips = (row) => row.getByRole("list", { name: "스킬 정보" }).getByRole("listitem");

test("1280: 고른 자리 숫자, 올리면 효과 카드, 스킬 종류 표시 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await watchShifts(page);
  await gotoReady(page, characterPath("상세", "skills"));

  const kind = /^(각성기|초각성기|초각성 스킬|초각성)$/;
  // Default list: a 초각성 스킬 (1) with its chip; 0 / missing are normal skills;
  // no 각성기 (100) or 초각성기 (101) — the equipped one of each pair is unknown.
  const expand = page.getByRole("button", { name: /전체 \d+개 스킬 보기/ });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(chips(skillRow(page, "합성 화염"))).toContainText(["초각성 스킬"]);
  await expect(skillRow(page, "합성 중력").getByText(kind)).toHaveCount(0);
  await expect(skillRow(page, "합성 포격").getByText(kind)).toHaveCount(0);
  for (const name of ["합성 각성", "합성 초각성기", "기본 스킬"])
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  // Expanded: the pair shows with its own labels; a plain Lv.1 skill has none.
  await expand.click();
  await expect(expand).toHaveAttribute("aria-expanded", "true");
  await expect(chips(skillRow(page, "합성 각성"))).toContainText(["각성기"]);
  await expect(chips(skillRow(page, "합성 초각성기"))).toContainText(["초각성기"]);
  await expect(skillRow(page, "기본 스킬").getByText(kind)).toHaveCount(0);
  await expand.click();
  await expect(expand).toHaveAttribute("aria-expanded", "false");

  // 연발 포격 = 2단계 2번째: the number 2 after the name (no dots), the place read in words.
  const cannon = skillRow(page, "합성 포격");
  // The button's label replaces its text for screen readers: the place is in it.
  const trigger = cannon.getByRole("button", { name: tripodLabel("연발 포격", "2단계 · 2번째") });
  const slot = trigger.locator("[class*=tripodSlot]");
  await expect(slot).toHaveText("2");
  await expect(slot).toHaveAttribute("aria-hidden", "true");
  await expect(trigger.locator("i")).toHaveCount(0);
  // Every tripod's number in the row (1단계 1번째 … as the mock gives them).
  await expect(cannon.locator("[class*=tripodSlot]")).toHaveText(["1", "2", "1"]);

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
