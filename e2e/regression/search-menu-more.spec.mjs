// 회귀(M53, PM 총괄 11-21): 헤더 검색 패널. 입력하면 메뉴는 8줄까지, 더 있으면 '메뉴 N개 더 보기' 줄이
// 나머지를 그 자리에서 펼친다(위 줄은 움직이지 않고, 펼친 첫 줄이 이어서 ↓로 갈 줄이 된다). 빈 칸에는
// '도구 바로가기'(메뉴의 이름 그대로, 켜진 도구만). 입력칸이 포커스를 지키므로 ↑↓로 고른 줄은 패널
// 안에서 늘 보이도록 스크롤된다(320에서 목록이 상자보다 길다).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

async function openSearch(page) {
  await gotoReady(page, "/market");
  await page.getByRole("button", { name: "캐릭터 검색" }).first().click();
  const box = page.getByRole("combobox", { name: "캐릭터 이름" });
  await expect(box).toBeFocused();
  return { box, list: page.getByRole("listbox", { name: "검색 결과" }) };
}

/** A row's top inside the scroll box's content (independent of how far the box is scrolled or how far the card has unfolded). */
const contentTop = (row) =>
  row.evaluate((el) => {
    const view = el.closest(".rsp-scroll");
    // Layout pixels: the card may still be unfolding (scaled), which a plain rect difference would read as a move.
    const outer = view.getBoundingClientRect();
    const scale = outer.height / view.offsetHeight;
    return (el.getBoundingClientRect().top - outer.top) / scale + view.scrollTop;
  });

/** The active row (aria-activedescendant) and whether it sits inside the panel's scroll box. */
async function activeRow(page, box) {
  const id = await box.getAttribute("aria-activedescendant");
  expect(id, "a row is active").toBeTruthy();
  const place = await page.evaluate((rowId) => {
    const row = document.getElementById(rowId);
    const view = row?.closest(".rsp-scroll");
    if (!row || !view) return null;
    const r = row.getBoundingClientRect();
    const v = view.getBoundingClientRect();
    return { inside: r.top >= v.top - 0.5 && r.bottom <= v.bottom + 0.5, row: [Math.round(r.top), Math.round(r.bottom)], view: [Math.round(v.top), Math.round(v.bottom)] };
  }, id);
  return { id, text: await page.locator(`[id="${id}"]`).innerText(), place };
}

for (const width of [320, 1280])
  test.describe(`${width}`, () => {
    test.use({ viewport: { width, height: 720 } });

    test(`@검색 ${width}: 메뉴는 8줄과 '더 보기' 줄, 누르면 그 자리에서 나머지가 펼쳐지고 ↓가 이어진다 @regression`, async ({ page }) => {
      const { box, list } = await openSearch(page);
      await page.keyboard.type("기");
      const menu = list.getByRole("group", { name: "메뉴" });
      const more = menu.getByRole("option", { name: /^메뉴 \d+개 더 보기/ });
      await expect(more).toBeVisible();
      await expect(menu.getByRole("option")).toHaveCount(9);
      const rest = Number((await more.innerText()).match(/메뉴 (\d+)개/)[1]);
      expect(rest).toBeGreaterThan(0);
      const eighth = menu.getByRole("option").nth(7);
      const before = await contentTop(eighth);
      const eighthText = await eighth.innerText();

      // A favourite change first (Shift+Enter on the lookup row): its note holds the live region (#1881 P2).
      const live = page.locator('p[role="status"]');
      await box.press("Shift+Enter");
      await expect(live.filter({ hasText: "‘기’ 즐겨찾기 추가" })).toHaveCount(1);

      // ↑ from the lookup row wraps to the last row: the more row, scrolled into the box.
      await page.keyboard.press("ArrowUp");
      const onMore = await activeRow(page, box);
      expect(onMore.text).toMatch(/메뉴 \d+개 더 보기/);
      expect(onMore.place?.inside, JSON.stringify(onMore.place)).toBe(true);

      await page.keyboard.press("Enter");
      await expect(more).toHaveCount(0);
      await expect(menu.getByRole("option")).toHaveCount(8 + rest);
      // Said every time, also over the favourite note.
      await expect(live.filter({ hasText: new RegExp(`^메뉴 ${8 + rest}개 모두 보여요$`) })).toHaveCount(1);
      await expect(live.filter({ hasText: "즐겨찾기" })).toHaveCount(0);
      // The panel stays open, the field keeps focus, and the first revealed row is the active one.
      await expect(box).toBeFocused();
      const revealed = await activeRow(page, box);
      expect(revealed.text).toBe(await menu.getByRole("option").nth(8).innerText());
      expect(revealed.place?.inside, JSON.stringify(revealed.place)).toBe(true);
      // Nothing above moved.
      expect(await menu.getByRole("option").nth(7).innerText()).toBe(eighthText);
      expect(Math.abs((await contentTop(eighth)) - before)).toBeLessThan(0.5);

      // A shorter screen (a phone keyboard, a resized window): the box shrinks under the active row,
      // which is brought back into it (#1881 P3).
      await page.setViewportSize({ width, height: 460 });
      await expect.poll(async () => (await activeRow(page, box)).place?.inside, { timeout: 3000 }).toBe(true);

      // ↓ goes on to the next revealed row (or wraps to the top after the last).
      await page.keyboard.press("ArrowDown");
      const next = await activeRow(page, box);
      if (rest > 1) expect(next.text).toBe(await menu.getByRole("option").nth(9).innerText());
      else expect(next.text).toContain("정보 보기");
      expect(next.place?.inside, JSON.stringify(next.place)).toBe(true);

      // Any edit folds it again: a space alone (the trimmed word is the same, #1881 P3) …
      await page.keyboard.type(" ");
      await expect(menu.getByRole("option", { name: /^메뉴 \d+개 더 보기/ })).toBeVisible();
      await expect(menu.getByRole("option")).toHaveCount(9);
      await expect(live.filter({ hasText: "모두 보여요" })).toHaveCount(0);
      await page.keyboard.press("Backspace");
      // … and a way back to the same word.
      await page.keyboard.press("Backspace");
      await page.keyboard.type("기");
      await expect(menu.getByRole("option", { name: /^메뉴 \d+개 더 보기/ })).toBeVisible();
      await expect(menu.getByRole("option")).toHaveCount(9);
    });

    test(`@검색 ${width}: 빈 칸의 도구 바로가기는 켜진 도구만 차례대로, ↑로 닿은 마지막 줄도 보이고 Enter로 간다 @regression`, async ({ page }) => {
      const { box, list } = await openSearch(page);
      const flags = await page.evaluate(() => fetch("/api/flags").then((r) => r.json()));
      const tools = list.getByRole("group", { name: "도구 바로가기" });
      const names = ["재련 기대 비용", "경매 입찰가", "거래소 시세", "숙제 체크", ...(flags.combatPower === true ? ["전투력 시뮬레이터"] : [])];
      await expect(tools.getByRole("option")).toHaveCount(names.length);
      for (const [i, name] of names.entries()) await expect(tools.getByRole("option").nth(i)).toContainText(name);
      // The tools come after 기능, the panel's last group.
      const groups = await list.getByRole("group").evaluateAll((els) => els.map((el) => el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby"))?.textContent));
      expect(groups.slice(-2)).toEqual(["기능", "도구 바로가기"]);

      // Nothing active: ↑ reaches the last row, which is scrolled into the box (the list is longer than it at 320).
      await page.keyboard.press("ArrowUp");
      const last = await activeRow(page, box);
      expect(last.text).toContain(names.at(-1));
      expect(last.place?.inside, JSON.stringify(last.place)).toBe(true);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`${flags.combatPower === true ? "/tools/combat-power" : "/tools/homework"}$`));
    });
  });
