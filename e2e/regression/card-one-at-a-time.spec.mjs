// 회귀(사용자 10-31): 아이템 상세 카드는 한 번에 하나. 클릭으로 고정한 카드도 다른 아이템에
// 마우스를 올리면(또는 키보드 초점이 가면) 닫히고, 올린 아이템의 카드가 평소처럼 열린다.
// 휴대폰은 아래 시트가 열린 채 뒤의 다른 아이템을 누르면 한 번에 그 아이템 시트로 바뀐다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const triggers = (page) => page.locator("[data-slot=item-tooltip-trigger]:visible");
const cardName = async (trigger) => (await trigger.getAttribute("aria-label")).replace(/ 상세 보기$/, "");
// Open cards only: a closing card stays in the page for its 100ms fade.
const cards = (page) => page.locator("[data-slot=item-tooltip][data-open]");
/** The one open card, named `name`, with its 150ms open transition finished (hover-stable). */
async function settledCard(page, name) {
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toHaveAttribute("aria-label", name);
  // Out of its starting style. (Its transitions keep reporting as running in
  // the test browser, so the pointer moves by coordinates below instead of
  // hover(), which waits for the target to stand still.)
  await expect(cards(page)).not.toHaveAttribute("data-starting-style", /.*/);
}
/** Puts the pointer on the middle of `locator` without waiting for it to be still. */
async function pointAt(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

test("1280: 고정한 카드는 다른 아이템에 올리면 닫히고 그 카드가 열린다, 초점도 같다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, characterPath("상세", "combat"));
  const [a, b] = [triggers(page).nth(0), triggers(page).nth(1)];
  const [nameA, nameB] = [await cardName(a), await cardName(b)];
  // Both items in the middle of the screen, clear of the sticky header and tab
  // bar (the bar's links took the pointer when an item sat under it).
  await a.evaluate((el) => el.scrollIntoView({ block: "center" }));

  // A click pins A: it stays when the pointer goes onto its own card.
  await a.click();
  await settledCard(page, nameA);
  await pointAt(page, cards(page));
  await page.waitForTimeout(300);
  await expect(cards(page)).toHaveAttribute("aria-label", nameA);

  // Hovering B: A closes, B's card opens as a hover preview would.
  await pointAt(page, b);
  await settledCard(page, nameB);

  // Keyboard: pin A again, then focus B; A's card closes.
  await page.mouse.move(0, 0);
  await expect(cards(page)).toHaveCount(0);
  await a.click();
  await settledCard(page, nameA);
  await b.focus();
  await expect(page.locator(`[data-slot=item-tooltip][data-open][aria-label="${nameA}"]`)).toHaveCount(0);
  // The closing card does not pull focus back to its own item (frontend-a11y).
  await expect(b).toBeFocused();
});

test.describe("휴대폰", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("390: 시트가 열린 채 뒤의 다른 아이템을 누르면 그 아이템 시트로 바뀐다 @regression", async ({ page }) => {
    await gotoReady(page, characterPath("상세", "combat"));
    const [a, b] = [triggers(page).nth(0), triggers(page).nth(1)];
    // Both items near the top, above where the sheet rises.
    await a.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 160));
    const [nameA, nameB] = [await cardName(a), await cardName(b)];
    await a.tap();
    await expect(page.getByRole("dialog", { name: nameA })).toBeVisible();
    // B sits above the sheet, behind its backdrop: one tap there opens B.
    const box = await b.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole("dialog", { name: nameB })).toBeVisible();
    await expect(page.getByRole("dialog", { name: nameA })).toHaveCount(0);
  });
});
