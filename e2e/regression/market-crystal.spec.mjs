// 회귀(PM 총괄 11-22 흡수 X6, 부분): 시세 화면의 블루 크리스탈 카드. 공식 경로만 — 공식 상점 비율(100개 = 로열 크리스탈
// 2,750개)과 기준 날짜, 교환소 시세는 공식으로 받을 곳이 없어 사용자가 넣는 값(로아샵 효율 계산기와 같은 값, 이 브라우저에만,
// 기본값 없음). 넣었을 때만 로열 크리스탈 1개 = 27,300 ÷ 2,750 = 9.927… → '약 9.93골드'. 값이 들어와도 카드 높이는 그대로.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const SHOP_RATE = /게임 안 크리스탈 교환소 시세\(블루 크리스탈 100개당 골드\)/;

for (const width of [320, 1280])
  test(`${width}: 블루 크리스탈 카드 — 공식 상점 비율, 내가 넣은 교환소 시세로만 계산, 로아샵과 같은 값 @regression`, async ({ page }) => {
    const sent = [];
    page.on("request", (request) => sent.push(`${request.url()} ${request.postData() ?? ""}`));
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/market");
    const card = page.getByRole("region", { name: "블루 크리스탈" });
    await expect(card).toContainText("100개 = 로열 크리스탈 2,750개");
    await expect(card).toContainText(/판매가 기준 · 확인 \d{4}-\d{2}-\d{2}/);
    await expect(card.getByRole("link", { name: "공식 상점" })).toHaveAttribute("href", /^https:\/\/lostark\.game\.onstove\.com\//);

    // No default: an empty field and no gold figure until the user types one.
    const field = card.getByRole("textbox", { name: /게임 안 교환소 시세/ });
    await expect(field).toHaveValue("");
    const royal = card.getByRole("definition").nth(1);
    await expect(royal).toContainText("—");
    await expect(royal).toContainText("교환소 시세를 넣으면 계산해요");
    await expect(royal).not.toContainText("골드");
    const height = (await card.boundingBox()).height;

    // Thousands commas are fine, and kept as typed.
    await field.fill("27,300");
    await expect(field).toHaveValue("27,300");
    await expect(royal).toContainText("약 9.93골드");
    await expect(field).not.toHaveAttribute("aria-invalid");
    await field.fill("27300");
    await expect(royal).toContainText("약 9.93골드");
    await expect(royal).toContainText("내가 넣은 교환소 시세 기준");
    expect((await card.boundingBox()).height, "값을 넣어도 카드 높이 그대로").toBeCloseTo(height, 0);

    // Phones: 44px to press — the field itself, and the two links' tap areas (hit-44, A36).
    if (width < 700) {
      expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(44);
      for (const name of ["공식 상점", "로아샵 효율 계산기에서 패키지 이득 보기"]) {
        const area = await card.getByRole("link", { name }).evaluate((el) => {
          const after = getComputedStyle(el, "::after");
          return { w: parseFloat(after.width), h: parseFloat(after.height) };
        });
        expect(area.h, `${name} 누르는 높이`).toBeGreaterThanOrEqual(44);
        expect(area.w, `${name} 누르는 폭`).toBeGreaterThanOrEqual(44);
      }
    }

    // Nothing in the card is wider than the card, whatever the font (CI #1889: the input's own ~20-character width
    // widened the field's grid to 348px at 320, Linux fonts; Windows fonts fit). Squeezed to 180px, every box stays
    // inside the card's content box, and the field fills it.
    const squeezed = await card.evaluate((el) => {
      el.style.width = "180px";
      const style = getComputedStyle(el);
      const inner = el.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      const over = [...el.querySelectorAll("*")]
        .filter((node) => node.getBoundingClientRect().right > inner + 0.5)
        .map((node) => `${node.tagName.toLowerCase()} right=${Math.round(node.getBoundingClientRect().right)} "${(node.textContent ?? "").trim().slice(0, 24)}"`);
      const input = el.querySelector("input").getBoundingClientRect();
      const label = el.querySelector("label").getBoundingClientRect();
      el.style.width = "";
      return { over, inner: Math.round(inner), fills: Math.abs(input.width - label.width) < 0.5 };
    });
    expect(squeezed.over, `카드 밖으로 나간 상자(카드 안쪽 오른쪽 ${squeezed.inner})`).toEqual([]);
    expect(squeezed.fills, "입력칸이 칸 너비를 채운다").toBe(true);

    // Kept in this browser, and the 로아샵 계산기 reads the same value.
    await page.reload();
    await expect(page.getByRole("region", { name: "블루 크리스탈" }).getByRole("textbox", { name: /게임 안 교환소 시세/ })).toHaveValue("27300");
    await expect(page.getByRole("region", { name: "블루 크리스탈" }).getByRole("textbox", { name: /게임 안 교환소 시세/ })).not.toHaveAttribute("aria-invalid");
    await expect(page.getByRole("region", { name: "블루 크리스탈" }).getByRole("definition").nth(1)).toContainText("약 9.93골드");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("region", { name: "블루 크리스탈" }).getByRole("link", { name: "로아샵 효율 계산기에서 패키지 이득 보기" }).click();
    await expect(page).toHaveURL(/\/tools\/loa-shop$/);
    await expect(page.getByRole("textbox", { name: SHOP_RATE })).toHaveValue("27300");
    expect(sent.filter((line) => /27,?300|27%2C300/.test(line)), "입력한 시세를 서버로 보내지 않는다").toEqual([]);
  });

// codex P2 on #1889: a wrong value is never read as some other number ('-27300' was 27300, '1.5' was 15). It stays
// as typed, is marked invalid with its message tied to the field and read politely, and nothing is calculated — on
// the card and on the 로아샵 계산기 (the same value).
test("320: 교환소 시세가 잘못되면 다른 숫자로 읽지 않고, 오류 문구를 필드에 묶어 알린다(시세 · 로아샵) @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoReady(page, "/market");
  const card = page.getByRole("region", { name: "블루 크리스탈" });
  const field = card.getByRole("textbox", { name: /게임 안 교환소 시세/ });
  const royal = card.getByRole("definition").nth(1);
  const message = /1 이상의 정수로 넣어 주세요\./;
  for (const typed of ["-27300", "1.5", "2,73,00", "0"]) {
    await field.fill(typed);
    await expect(field, typed).toHaveValue(typed);
    await expect(field, typed).toHaveAttribute("aria-invalid", "true");
    await expect(field, typed).toHaveAccessibleDescription(message);
    await expect(card.getByRole("status"), typed).toHaveText(message);
    await expect(royal, typed).toContainText("—");
    await expect(royal, typed).toContainText("넣은 값으로는 계산하지 않아요");
    await expect(royal, typed).not.toContainText("골드");
  }
  // Only a valid rate is saved (codex P2 on #1889): valid → invalid → reload brings the valid one back.
  await field.fill("27300");
  await expect(royal).toContainText("약 9.93골드");
  await field.fill("-27300");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await page.reload();
  const cardAgain = page.getByRole("region", { name: "블루 크리스탈" });
  await expect(cardAgain.getByRole("textbox", { name: /게임 안 교환소 시세/ })).toHaveValue("27300");
  await expect(cardAgain.getByRole("textbox", { name: /게임 안 교환소 시세/ })).not.toHaveAttribute("aria-invalid");
  await expect(cardAgain.getByRole("definition").nth(1)).toContainText("약 9.93골드");

  // The 로아샵 계산기: the same saved rate; an invalid entry is marked, calculates no gain, and is not saved either.
  await gotoReady(page, "/tools/loa-shop");
  const shopField = page.getByRole("textbox", { name: SHOP_RATE });
  const gain = page.getByText(/로열 크리스탈로 환산한 가치/).first();
  await expect(shopField).toHaveValue("27300");
  await expect(gain).toBeVisible();
  // The field and its error slot are one item of the settings column: the hint follows that group by the column's
  // gap plus its own margin, and the live region is always in the page (codex P3s on #1889).
  const layout = () =>
    shopField.evaluate((input) => {
      const group = input.closest("label").parentElement;
      // The hint (the field's description while it is valid) is the next box in the column.
      const hint = document.getElementById(input.getAttribute("aria-describedby").split(" ").at(-1));
      return {
        gap: parseFloat(getComputedStyle(group.parentElement).rowGap) + parseFloat(getComputedStyle(hint).marginTop),
        between: hint.getBoundingClientRect().top - group.getBoundingClientRect().bottom,
        hintTop: hint.getBoundingClientRect().top + window.scrollY,
        inPage: !!group.querySelector('[role="status"]'),
      };
    });
  const valid = await layout();
  expect(valid.inPage, "상태 줄은 늘 필드 묶음 안에").toBe(true);
  expect(Math.abs(valid.between - valid.gap), JSON.stringify(valid)).toBeLessThan(0.5);
  await shopField.fill("1.5");
  await expect(shopField).toHaveValue("1.5");
  await expect(shopField).toHaveAttribute("aria-invalid", "true");
  await expect(shopField).toHaveAccessibleDescription(message);
  await expect(page.getByRole("status").filter({ hasText: message })).toHaveCount(1);
  await expect(page.getByText(/로열 크리스탈로 환산한 가치/)).toHaveCount(0);
  // The message takes its own slot: the hint (and the list under it) stays where it was.
  expect((await layout()).hintTop, "오류가 나와도 설명 자리 그대로").toBeCloseTo(valid.hintTop, 0);
  await shopField.fill("27300");
  await expect(shopField).not.toHaveAttribute("aria-invalid");
  expect((await layout()).hintTop, "고쳐도 설명 자리 그대로").toBeCloseTo(valid.hintTop, 0);
  // The message wrapped (as at 320 with 200% text, codex P3 on #1899): the field group squeezed to 110px makes it
  // several lines. The slot is that tall already, so the message coming and going still moves nothing below.
  const squeeze = (width) => shopField.evaluate((input, w) => (input.closest("label").parentElement.style.width = w), width);
  await squeeze("110px");
  const narrow = await layout();
  await shopField.fill("1.5");
  await expect(shopField).toHaveAttribute("aria-invalid", "true");
  const wrapped = await page.getByRole("status").filter({ hasText: message }).evaluate((el) => el.getBoundingClientRect().height);
  expect(wrapped, "문구가 여러 줄").toBeGreaterThan(30);
  expect((await layout()).hintTop, "여러 줄 오류에도 설명 자리 그대로").toBeCloseTo(narrow.hintTop, 0);
  await shopField.fill("27300");
  await expect(shopField).not.toHaveAttribute("aria-invalid");
  expect((await layout()).hintTop, "여러 줄 오류가 사라져도 설명 자리 그대로").toBeCloseTo(narrow.hintTop, 0);
  await squeeze("");
  await shopField.fill("1.5");
  await expect(shopField).toHaveAttribute("aria-invalid", "true");
  await page.reload();
  await expect(page.getByRole("textbox", { name: SHOP_RATE })).toHaveValue("27300");
  await expect(page.getByRole("textbox", { name: SHOP_RATE })).not.toHaveAttribute("aria-invalid");
  await expect(gain).toBeVisible();
  // The status line is empty (the slot's unseen sizing copy, aria-hidden, always holds the text).
  await expect(page.getByRole("status").filter({ hasText: message })).toHaveCount(0);
});

// codex P3 on #1889: a rate saved in another tab reaches this tab's card at once (the storage event), with no reload;
// clearing it there empties it here.
test("1280: 다른 탭에서 바꾼 교환소 시세가 이 탭의 카드에 바로 들어온다 @regression", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market");
  const royal = page.getByRole("region", { name: "블루 크리스탈" }).getByRole("definition").nth(1);
  const field = page.getByRole("region", { name: "블루 크리스탈" }).getByRole("textbox", { name: /게임 안 교환소 시세/ });
  await expect(field).toHaveValue("");
  const other = await context.newPage();
  await gotoReady(other, "/tools/loa-shop");
  await other.getByRole("textbox", { name: SHOP_RATE }).fill("27500");
  await expect(field).toHaveValue("27500");
  await expect(royal).toContainText("약 10골드");
  await other.getByRole("textbox", { name: SHOP_RATE }).fill("");
  await expect(field).toHaveValue("");
  await expect(royal).toContainText("—");
  await other.close();
});

// codex P3 on #1899: a rate changed in another tab while no card or shop tool was on screen here (nothing listening
// for its storage event) is read again when one comes back.
test("1280: 이 탭에 시세 화면이 없는 동안 다른 탭에서 바꾼 값도 돌아오면 보인다 @regression", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/market");
  const field = () => page.getByRole("region", { name: "블루 크리스탈" }).getByRole("textbox", { name: /게임 안 교환소 시세/ });
  await field().fill("27300");
  // Away from the card, in the app (the store stays in memory, no one listening).
  await page.getByRole("link", { name: "LOAKraken 홈" }).click();
  await expect(page).toHaveURL(/\/$/);
  const other = await context.newPage();
  await gotoReady(other, "/tools/loa-shop");
  await other.getByRole("textbox", { name: SHOP_RATE }).fill("28050");
  await other.close();
  // Back to the card without a reload: the new value, not the one this tab last saw.
  await page.goBack();
  await expect(page).toHaveURL(/\/market/);
  await expect(field()).toHaveValue("28050");
  await expect(page.getByRole("region", { name: "블루 크리스탈" }).getByRole("definition").nth(1)).toContainText("약 10.2골드");
});
