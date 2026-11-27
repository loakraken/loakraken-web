// 회귀(X4 (a), web #1975): 지옥 · 나락 보상의 '원정대에서 고르기'. 캐릭터 이름 하나로 원정대를 불러오고, 캐릭터 카드를
// 누르면 열쇠 단계가 그 캐릭터가 들어갈 수 있는 가장 높은 단계(아이템 레벨 이하)로 바뀐다. 1640 미만은 누를 수 없다.
// 목 '지옥원정대': 1760.83 · 1745 · 1712.5 · 1650 · 1600. 원정대가 늦게 와도(답을 붙잡아 둠), 이 브라우저에 남긴 원정대가
// 첫 화면 뒤에 들어와도 아래 도구가 움직이지 않는다.
import { test, expect, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const ROUTE = "/api/characters/siblings";
const roster = (page) => page.getByRole("region", { name: "원정대에서 고르기" });
const cards = (page) => roster(page).getByRole("list", { name: "원정대 캐릭터" }).getByRole("button");
const card = (page, name) => cards(page).filter({ hasText: name });
const levelRadio = (page, level) =>
  page.getByRole("radiogroup", { name: "열쇠 단계(입장 레벨)" }).getByRole("radio", { name: String(level) });
// The tool below the roster row: where it sits on the page.
const below = (page) =>
  page.locator("#hell-value-heading").evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));

for (const width of [320, 1280])
  test(`${width}: 원정대를 불러와 캐릭터를 누르면 그 열쇠 단계, 늦은 답에도 도구가 제자리 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === ROUTE,
      async (route) => {
        await held;
        await route.continue().catch(() => {});
      },
    );
    // Nothing is held before the press, so the page settles first (fonts too).
    await gotoReady(page, "/tools/hell-reward");
    await page.evaluate(() => document.fonts.ready);
    await expect(roster(page)).toContainText("누른 캐릭터가 들어갈 수 있는 열쇠 단계로");
    const before = await below(page);

    await roster(page).getByRole("textbox", { name: "원정대 캐릭터 이름" }).fill("지옥원정대");
    await roster(page).getByRole("button", { name: "불러오기" }).click();
    await expect(roster(page).getByRole("button", { name: "불러오는 중…" })).toBeVisible();
    expect(await below(page), "기다리는 동안").toBe(before);
    release();

    // Highest item level first; each card names the key it opens.
    await expect(cards(page)).toHaveCount(5);
    await expect(cards(page).nth(0)).toContainText("지옥둘");
    await expect(card(page, "지옥둘")).toContainText("1,760.83");
    await expect(card(page, "지옥둘")).toContainText("1750 열쇠");
    await expect(card(page, "지옥셋")).toContainText("1730 열쇠");
    await expect(card(page, "지옥원정대")).toContainText("1700 열쇠");
    await expect(card(page, "지옥넷")).toContainText("1640 열쇠");
    await expect(card(page, "지옥다섯")).toContainText("입장 불가(1640 미만)");
    await expect(roster(page).getByRole("status")).toContainText("기준 아이템 레벨이에요.");
    expect(await below(page), "답 뒤").toBe(before);

    // 1745 → 1730 (between two levels), kept in the address like a picked level (#889).
    await card(page, "지옥셋").click();
    await expect(levelRadio(page, 1730)).toBeChecked();
    await expect(page).toHaveURL(/level=1730/);
    await expect(card(page, "지옥셋")).toHaveAttribute("aria-pressed", "true");
    // Below the lowest level: no change.
    await expect(card(page, "지옥다섯")).toHaveAttribute("aria-disabled", "true");
    // An aria-disabled button: Playwright waits for it to be enabled, so the click is sent as the event itself.
    await card(page, "지옥다섯").dispatchEvent("click");
    await expect(levelRadio(page, 1730)).toBeChecked();
    // Picking a level by hand: the card no longer says it is the one in use.
    await levelRadio(page, 1750).click();
    await expect(card(page, "지옥셋")).toHaveAttribute("aria-pressed", "false");
    await card(page, "지옥원정대").click();
    await expect(levelRadio(page, 1700)).toBeChecked();
    await expectNoHorizontalOverflow(page);
  });

test("다시 열면 이 브라우저에 남긴 원정대가 다시 부르지 않고 나오고, 흔들림 0 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoReady(page, "/tools/hell-reward");
  await roster(page).getByRole("textbox", { name: "원정대 캐릭터 이름" }).fill("지옥원정대");
  await roster(page).getByRole("button", { name: "불러오기" }).click();
  await card(page, "지옥셋").click();
  await expect(page).toHaveURL(/level=1730/);

  const asked = [];
  page.on("request", (r) => new URL(r.url()).pathname === ROUTE && asked.push(r.url()));
  await watchShifts(page);
  await page.reload();
  await expect(cards(page)).toHaveCount(5);
  await expect(card(page, "지옥셋")).toHaveAttribute("aria-pressed", "true");
  await expect(levelRadio(page, 1730)).toBeChecked();
  await expect(roster(page).getByRole("button", { name: "다시 불러오기" })).toBeVisible();
  await page.waitForTimeout(600);
  expect(asked, "다시 열 때 원정대 요청 없음").toEqual([]);
  const { all, moved } = await shiftsSince(page);
  expect(all, `흔들림 (${moved})`).toBe(0);
});

test("원정대를 불러오지 못하면 그 줄에 알린다 @regression", async ({ page }) => {
  await gotoReady(page, "/tools/hell-reward");
  await roster(page).getByRole("textbox", { name: "원정대 캐릭터 이름" }).fill("원정대오류");
  await roster(page).getByRole("button", { name: "불러오기" }).click();
  await expect(roster(page).getByRole("status")).toHaveText("원정대를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  await expect(cards(page)).toHaveCount(0);
});
