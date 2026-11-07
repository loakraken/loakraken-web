// 회귀(L13·K11·L44, API 목록 #5): 칭호 장착 비율 — 통계 '칭호' 탭(확인한 원정대 중 그 칭호를 장착한 원정대 비율)과
// 원정대 칭호 목록의 '장착 원정대 x%'. 장착만 셈(보유 아님)을 화면에 적는다.
import { test, expect, characterPath, gotoReady, chooseOption } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

test("통계 칭호 탭: 비율 표·서버 바꾸기·장착만 안내 @regression", async ({ page }) => {
  await gotoReady(page, "/stats?tab=titles");
  await expect(page.getByRole("tab", { name: "칭호", selected: true })).toBeVisible();
  const table = page.getByRole("table", { name: "칭호 장착 원정대 비율" });
  // Names in the api's order; a variant (첫 주 클리어) right under its title.
  await expect(table.locator("[class*=titleName]")).toHaveText([
    "빛을 꺼트리는 자",
    "에키드나를 쓰러뜨린 자",
    "뇌전의 군주",
    "뇌전의 군주 (첫 주 클리어)",
    "심연의 끝을 마주한 자",
    "별을 제패한 자",
    "카제로스 The 1st",
  ]);
  await expect(table.locator("tbody tr").first()).toContainText("400개");
  await expect(table.locator("tbody tr").first()).toContainText("32.26%");
  await expect(page.getByText(/장착하지 않은 칭호는 알 수 없어 세지 않아요/)).toBeVisible();
  // User 11-08: grade word and 획득 조건 on the row; the variant has no rank of its own.
  const first = table.locator("tbody tr").first();
  await expect(first.locator("[class*=titleGrade]")).toHaveText("희귀");
  // No fill under the grade word: its text colour keeps the token's >= 4.5:1 on the surface.
  await expect(first.locator("[class*=titleGrade]")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(first).toContainText("카멘을 처치한다");
  await expect(table.locator("tbody tr[data-child] td").first()).toHaveText("");
  // A title not in the table (no grade) keeps the plain colour, no grade word.
  const plain = table.locator("tbody tr").nth(1);
  await expect(plain.locator("[class*=titleGrade]")).toHaveCount(0);
  await expect(plain.locator("[class*=titleName]")).toHaveAttribute("data-grade", "unknown");
  // Summary line, and compare with a stored day (contract v1.2).
  await expect(page.getByText(/^칭호 6종/)).toBeVisible();
  await chooseOption(page, page.getByRole("combobox", { name: "비교" }), "2026. 11. 07");
  await expect(table.locator("thead")).toContainText("2026. 11. 07 대비");
  await expect(first).toContainText("+4.84%p");
  await chooseOption(page, page.getByRole("combobox", { name: "비교" }), "안 함");
  // The dated header ("원정대" + "비율" alone would contain "대비").
  await expect(table.locator("thead")).not.toContainText("11. 07 대비");

  // A7: the server change moves nothing — shifts right after the input count too.
  const heads = () => table.locator("thead th").evaluateAll((cells) => cells.map((cell) => Math.round(cell.getBoundingClientRect().x)));
  const before = await heads();
  await page.evaluate(() => {
    window.__shifts = [];
    window.__moved = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__shifts.push(entry.value);
        // What moved, from where to where (the failure message says it).
        for (const { node, previousRect: a, currentRect: b } of entry.sources) {
          const el = node?.nodeType === 1 ? node : node?.parentElement;
          const name = el ? `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} '${(el.textContent ?? "").trim().slice(0, 24)}'` : "?";
          window.__moved.push(`${name} ${Math.round(a.x)},${Math.round(a.y)} ${Math.round(a.width)}x${Math.round(a.height)} → ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`);
        }
      }
    }).observe({ type: "layout-shift" });
  });
  // Heights of what sits over the table (the failure message names what grew).
  const above = () =>
    page.evaluate(() => {
      const bar = document.querySelector("[class*=titleBar]");
      const out = [];
      for (let n = bar; n && n !== document.body; n = n.parentElement)
        for (let s = n.previousElementSibling; s; s = s.previousElementSibling)
          out.push(`${s.tagName.toLowerCase()}.${String(s.className).split(" ")[0]}:${Math.round(s.getBoundingClientRect().height)}`);
      return out.join(" ");
    });
  const aboveBefore = await above();
  await chooseOption(page, page.getByRole("combobox", { name: "서버" }), "아만");
  await expect(page).toHaveURL(/server=/);
  await expect(page.getByText(/표본 30개 원정대 미만이라 참고값/)).toBeVisible();
  await page.waitForTimeout(800);
  const aboveAfter = await above();
  expect(
    await page.evaluate(() => window.__shifts.reduce((a, v) => a + v, 0)),
    `서버를 바꾼 뒤 layout-shift(입력 직후 포함): ${await page.evaluate(() => window.__moved.join(" | "))} || 위 높이 ${aboveBefore} → ${aboveAfter}`,
  ).toBe(0);
  expect(await heads()).toEqual(before);
});

test("원정대 칭호: 칭호마다 장착 원정대 비율 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "siblings"));
  await page.getByRole("tab", { name: "칭호" }).click();
  const list = page.getByRole("list").filter({ hasText: "빛을 꺼트리는 자" }).first();
  await expect(list).toContainText("장착 원정대 32.26%");
  // A title not in the shares (no record of anyone wearing it) shows no share.
  // The title line itself (a same-day group is an outer list item too).
  const kamen = page.getByText("카멘을 쓰러뜨린 자", { exact: true }).locator("xpath=..");
  await expect(kamen).not.toContainText("장착 원정대");
});

// PM-프론트 #1411 P2: the stored days come in their own answer. Held 800 ms, the
// day controls must already stand (disabled), so their arrival moves nothing.
for (const width of [320, 1280])
  test(`칭호 탭: 기준일 목록이 늦게 와도 흔들림 0 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    let held = 0;
    await page.route(
      (url) => url.pathname === "/api/titles/equipped/dates",
      async (route) => {
        held += 1;
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.continue();
      },
    );
    await gotoReady(page, "/stats?tab=titles");
    await expect(page.getByRole("table", { name: "칭호 장착 원정대 비율" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "비교" })).toBeEnabled();
    await page.waitForTimeout(400);
    expect(held, "기준일 목록 요청을 붙잡았는지").toBeGreaterThan(0);
    const moved = await shiftsSince(page);
    expect(moved.all, `기준일 목록이 온 뒤 흔들림 (${moved.moved})`).toBe(0);
  });

// #1411 P3: on a phone the change under each name answers late ('-' → '+4.84%p')
// in a fixed slot: nothing moves when the comparison day's answer comes.
test("칭호 탭 휴대폰: 비교 값이 늦게 와도 흔들림 0 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await watchShifts(page);
  await page.route(
    (url) => url.pathname === "/api/titles/equipped" && url.searchParams.has("date"),
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    },
  );
  await gotoReady(page, "/stats?tab=titles");
  const first = page.getByRole("table", { name: "칭호 장착 원정대 비율" }).locator("tbody tr").first();
  await chooseOption(page, page.getByRole("combobox", { name: "비교" }), "2026. 11. 07");
  // The column and the phone line appear with the choice (input); the answer comes later.
  await expect(first).toContainText("2026. 11. 07 대비 -");
  const mark = await shiftMark(page);
  await expect(first).toContainText("+4.84%p");
  await page.waitForTimeout(300);
  const moved = await shiftsSince(page, mark);
  expect(moved.all, `비교 값이 온 뒤 흔들림 (${moved.moved})`).toBe(0);
});
