// 회귀(사용자 11-01, PM 총괄 결정): 각인 카드 — 머리는 왼쪽에 각인 조합, 오른쪽에 '아크 패시브 활성화'.
// 각인마다 공식 아이콘이 없어(모든 줄이 같은 각인서 그림이었다) 그림 대신 등급 색 작은 표시를 이름 앞에 둔다.
// 유물 각인서 수는 공식 전투정보실의 빨간 표시 ×N, 스톤 레벨은 파란 표시 Lv.N(화면 읽기는 '유물 ×4'·'스톤 Lv.3').
// 이름은 모두 같은 x에서 시작하고 흔들림 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [320, 360, 1280])
  test(`${width}: 각인 카드 머리·등급 표시·유물/스톤 표시, 이름 줄 맞춤 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    // 대세블레이드 carries 돌격대장·아드레날린(스톤 3)·원한(스톤 2)·잔재된 기운·질량 증가, all 유물 ×4.
    await gotoReady(page, characterPath("대세블레이드"));
    const panel = page.getByRole("region", { name: "각인", exact: true });
    const row = (name) => panel.locator("li").filter({ has: page.getByText(name, { exact: true }) }).first();
    // No picture per row any more; the leading mark carries the grade colour.
    await expect(panel.locator("li img")).toHaveCount(0);
    const grade = await row("원한").evaluate((li) => {
      const mark = li.querySelector("i[data-grade]");
      const probe = document.createElement("span");
      probe.style.color = "var(--grade-relic-text)";
      li.append(probe);
      const relic = getComputedStyle(probe).color;
      probe.remove();
      return { kind: mark?.dataset.grade, colour: mark ? getComputedStyle(mark).backgroundColor === relic : false };
    });
    expect(grade).toEqual({ kind: "relic", colour: true });
    // Every name starts at the same x.
    const lefts = await panel.locator("li strong").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(new Set(lefts).size, `이름 시작 위치 ${lefts}`).toBe(1);
    // Head: book code on the left, '아크 패시브 활성화' on the right.
    const head = panel.locator("p").first();
    await expect(head.locator("b")).toHaveText(/^각인 조합 \d+$/);
    await expect(head.locator(":scope > span")).toHaveText("아크 패시브 활성화");
    const headBox = await head.evaluate((el) => {
      const [code, state] = [el.querySelector("b"), el.querySelector(":scope > span")].map((n) => n.getBoundingClientRect());
      return { codeLeft: Math.round(code.left - el.getBoundingClientRect().left), stateRight: Math.round(el.getBoundingClientRect().right - state.right) };
    });
    expect(headBox).toEqual({ codeLeft: 0, stateRight: 0 });
    // The official markers: red (relic count), blue (stone level).
    const marks = async (name) =>
      row(name).locator("i[data-kind]").evaluateAll((els) =>
        els.map((el) => {
          const style = getComputedStyle(el, "::before");
          // Compared as numbers: '0 0' computes to '0% 0%', '-29px 0' to '-29px 0px'.
          const [x, y] = style.backgroundPosition.split(" ").map(parseFloat);
          return [el.dataset.kind, x, y, style.backgroundImage.includes("/pc/profile/img_engrave_icon.png")];
        }),
      );
    expect(await marks("아드레날린")).toEqual([["relic", -29, 0, true], ["stone", 0, 0, true]]);
    expect(await marks("돌격대장")).toEqual([["relic", -29, 0, true]]);
    await expect(row("아드레날린")).toContainText("유물 ×4");
    await expect(row("아드레날린")).toContainText("스톤 Lv.3");
    await expect(row("원한")).toContainText("스톤 Lv.2");
    await page.waitForTimeout(600);
    const { quiet, moved } = await shiftsSince(page);
    expect(quiet, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

// PM-프론트 #1244 P3: if the official marker sprite cannot load, a sighted reader saw only "×4" (the "유물"
// word is for screen readers). Then the words show instead of the markers. The swap from mark to word after
// the probe fails moves that line once: accepted by design (PM-프론트 11-02, only when the sprite host is
// unreachable; reserving the word's width would leave a gap on every row). Narrow screens: the words wrap
// inside the row, nothing runs off the page or is cut.
for (const width of [320, 1280])
test(`${width}: 마커 그림을 못 불러오면 '유물'·'스톤' 글자가 보이고, 잘리거나 넘치지 않는다 @regression`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  // Later routes win over the fixture's image stub: the sprite fails to load.
  await page.route(/img_engrave_icon\.png/, (route) => route.abort());
  await gotoReady(page, characterPath("대세블레이드"));
  const panel = page.getByRole("region", { name: "각인", exact: true });
  const row = panel.locator("li").filter({ has: page.getByText("아드레날린", { exact: true }) }).first();
  await expect(row.locator("i[data-kind]")).toHaveCount(0);
  const counts = row.locator("[class*=engravingCount] > span");
  await expect(counts.nth(0)).toHaveText("유물 ×4");
  await expect(counts.nth(1)).toHaveText("스톤 Lv.3");
  // Real words on screen (not the 1px screen-reader text): the box holds them.
  expect((await counts.nth(0).boundingBox()).width).toBeGreaterThan(30);
  // Every count line keeps its text whole and inside its row.
  const cut = await panel.locator("li").evaluateAll((rows) =>
    rows.flatMap((li) =>
      [...li.querySelectorAll("[class*=engravingCount] > span")]
        .filter((span) => {
          const r = span.getBoundingClientRect();
          const box = li.getBoundingClientRect();
          return span.scrollWidth > span.clientWidth + 1 || r.right > box.right + 1 || r.left < box.left - 1;
        })
        .map((span) => span.textContent.trim()),
    ),
  );
  expect(cut, "잘리거나 줄 밖으로 나간 글자").toEqual([]);
  await expectNoHorizontalOverflow(page);
});
