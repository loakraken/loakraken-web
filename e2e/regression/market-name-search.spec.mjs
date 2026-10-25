// 회귀(#1115, api #624): 시세판 품목 이름 검색.
// - 이름 일부·초성(ㅇㅂㄷ)으로 지금 탭을 서버에서 거른다. 입력이 300ms 쉬면 한 번만 묻는다.
// - 한글을 조합하는 중에도 찾는다(조합이 끝나기를 기다리지 않는다).
// - 서버가 받지 않는 글자는 묻지 않고 한 줄 안내. 주소에 q가 남고, 검색어를 바꾸면 1쪽, 탭·정렬은 유지.
// - 일부만 찾았으면(complete=false) 안내, 없으면 빈 상태 문구. 검색칸·정렬은 제자리, 잘림·가로 넘침 0.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

/** Every board request's q (null when none), in order. */
const boardAsks = (page) => {
  const asked = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname === "/api/markets/board") asked.push(url.searchParams.get("q"));
  });
  return asked;
};
const field = (page) => page.getByRole("searchbox", { name: "품목 이름" });
const rows = (page) => page.locator("section", { has: page.locator("#board-heading") }).locator("ul li button strong");
/** Page coordinates (scrolling is not moving). */
const place = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.top + window.scrollY), Math.round(r.width), Math.round(r.height)];
  });

for (const scheme of ["light", "dark"])
  for (const width of [320, 360, 390, 1280])
    test(`@시세검색 ${scheme} ${width}: 초성으로 한 번 묻고, 주소에 남고, 제자리 @regression`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      const asked = boardAsks(page);
      await gotoReady(page, "/market");
      await expect(field(page)).toBeVisible();
      const sorts = page.getByRole("group", { name: "정렬" });
      const before = { field: await place(field(page)), sorts: await place(sorts) };

      // Initials of 아비도스 융화 재료, typed key by key: one question once typing rests.
      await field(page).pressSequentially("ㅇㅂㄷ", { delay: 60 });
      await expect(page).toHaveURL(/[?&]q=%E3%85%87%E3%85%82%E3%84%B7(&|$)/);
      await expect(rows(page).first()).toContainText("아비도스");
      await expect(page.locator("main").getByText("운명의 파괴석", { exact: true })).toHaveCount(0);
      await page.waitForTimeout(400);
      expect(asked.filter((q) => q !== null), "입력 중 요청").toEqual(["ㅇㅂㄷ"]);

      expect(await place(field(page)), "검색칸 제자리").toEqual(before.field);
      expect(await place(sorts), "정렬 단추 제자리").toEqual(before.sorts);
      const cut = await page.locator("[role=search] p, #board-heading").evaluateAll((els) =>
        els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
      );
      expect(cut, "잘림").toEqual([]);
      await expectNoHorizontalOverflow(page);
    });

// A slow answer lands well after the last key (outside the 0.5s input window):
// a shorter list or the pager going away must not pull up what is under them.
for (const width of [320, 360, 390, 1280])
  test(`@시세검색 ${width}: 늦게 온 검색 결과에도 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/\/api\/markets\/board\?/, async (route) => {
      if (new URL(route.request().url()).searchParams.get("q")) await new Promise((r) => setTimeout(r, 800));
      await route.fallback();
    });
    await watchShifts(page);
    await gotoReady(page, "/market");
    await page.waitForTimeout(500);
    const mark = await shiftMark(page);
    // 11 items on two pages → 2 items, no pager.
    await field(page).pressSequentially("ㅇㅂㄷ", { delay: 60 });
    await expect(rows(page)).toHaveCount(2);
    await page.waitForTimeout(600);
    const searched = await shiftsSince(page, mark);
    expect(searched.quiet, `검색 결과가 온 뒤 흔들림 (${searched.moved})`).toBe(0);
    // Back to the whole tab.
    const again = await shiftMark(page);
    await page.getByRole("button", { name: "검색어 지우기" }).click();
    await expect(rows(page)).toHaveCount(10);
    await page.waitForTimeout(600);
    const cleared = await shiftsSince(page, again);
    expect(cleared.quiet, `검색을 지운 뒤 흔들림 (${cleared.moved})`).toBe(0);
  });

test("@시세검색 한글을 조합하는 중에도 찾는다 @regression", async ({ page }) => {
  const asked = boardAsks(page);
  await gotoReady(page, "/market");
  await field(page).focus();
  // An IME still composing (no compositionend yet): the search goes out anyway.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "파괴석", selectionStart: 3, selectionEnd: 3 });
  await expect(page).toHaveURL(/[?&]q=%ED%8C%8C%EA%B4%B4%EC%84%9D(&|$)/);
  await expect(rows(page).first()).toContainText("파괴석");
  expect(asked.filter((q) => q !== null)).toEqual(["파괴석"]);
  // Finishing the composition with the same text asks nothing more.
  await cdp.send("Input.insertText", { text: "파괴석" });
  await page.waitForTimeout(600);
  expect(asked.filter((q) => q !== null)).toEqual(["파괴석"]);
});

test("@시세검색 받지 않는 글자는 묻지 않고 안내, 지우기·1쪽·탭·정렬 유지, 빈 결과 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  const asked = boardAsks(page);
  await gotoReady(page, "/market?sort=high&page=2");
  const note = page.locator("[role=search] p");

  await field(page).pressSequentially("파괴석!", { delay: 40 });
  await expect(note).toHaveText("기호는 ·()+-: 만 쓸 수 있어요.");
  await expect(field(page)).toHaveAttribute("aria-invalid", "true");
  await page.waitForTimeout(600);
  // Typing rested on '파괴석!' only: nothing went out.
  expect(asked.filter((q) => q !== null)).toEqual([]);
  await field(page).press("Backspace");
  await expect(note).toHaveText("");
  await expect.poll(() => asked.filter((q) => q !== null)).toEqual(["파괴석"]);

  // A new search starts at page 1 and keeps the sort.
  await expect(page).toHaveURL(/[?&]q=%ED%8C%8C%EA%B4%B4%EC%84%9D/);
  await expect(page).toHaveURL(/[?&]sort=high/);
  await expect(page).not.toHaveURL(/[?&]page=/);
  // Another tab keeps the search.
  await page.getByRole("tab").nth(1).click();
  await expect(page).toHaveURL(/[?&]q=%ED%8C%8C%EA%B4%B4%EC%84%9D/);
  await expect(field(page)).toHaveValue("파괴석");

  // Nothing matches: said plainly.
  await page.getByRole("button", { name: "검색어 지우기" }).click();
  await expect(page).not.toHaveURL(/[?&]q=/);
  await field(page).pressSequentially("zzz", { delay: 40 });
  await expect(page.getByRole("status").filter({ hasText: "‘zzz’에 맞는 품목이 이 분류에 없어요." })).toBeVisible();

  // Shared address: the same results from the first HTML.
  await gotoReady(page, "/market?q=%E3%85%87%E3%85%82%E3%84%B7");
  await expect(field(page)).toHaveValue("ㅇㅂㄷ");
  await expect(rows(page).first()).toContainText("아비도스");
});

test("@시세검색 일부 품목만 찾았으면 안내 @regression", async ({ page }) => {
  const seen = [];
  await page.route(/\/api\/markets\/board\?/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const envelope = body.envelope ?? body;
    const q = new URL(route.request().url()).searchParams.get("q");
    if (q && envelope?.data) envelope.data.complete = false;
    seen.push(`${q}:${Object.keys(body).join(",")}:${envelope?.data?.complete}`);
    await route.fulfill({ response, json: body });
  });
  await gotoReady(page, "/market");
  await field(page).pressSequentially("재료", { delay: 40 });
  await expect(page).toHaveURL(/[?&]q=/);
  await expect.poll(() => seen.some((s) => s.startsWith("재료:")), { message: `board answers: ${seen.join(" | ")}` }).toBe(true);
  await expect(page.locator("[role=search] p")).toHaveText("품목이 많아 일부 품목만 찾았어요.");
  await page.getByRole("button", { name: "검색어 지우기" }).click();
  await expect(page.locator("[role=search] p")).toHaveText("");
});
