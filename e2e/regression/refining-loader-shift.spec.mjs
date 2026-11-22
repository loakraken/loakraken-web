// A7 (PM-프론트 11-22, found by 프론트2 measuring #1955): /tools/refining?character=X loads the character with no input.
// When the answer arrived, the 캐릭터 장비 card grew by its 'loaded' line (and the note on parts it could not read) and
// pushed the 목표 단계 card 40px down. The answer is held here until the page is measured; the card keeps its height and
// nothing below it moves. Mock '재련': 어깨 is not 업화·전율, so the case with a part left out is the one measured.
// The longest line (PM-프론트 #1957 P3): a 12-letter name on the longest server name, at 320, still fits the lines held.
import { test, expect, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";
import { drawnFace } from "../support/fonts.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

/** A made-up 12-letter name (PM-프론트 #1957 P3) and the longest server name. */
const LONG_NAME = "가나다라마바사아자차카타";
const LONG_SERVER = "아브렐슈드";

/**
 * The longest line is measured once per face (PM-프론트 #1964 P3): the site font is display: optional, so a cold load
 * can stay on the fallback. "site": warmed first, then proven drawn by width (loaded is not drawn). "matched": the
 * font file blocked, so the metric-matched fallback draws (fonts.mjs drawnFace).
 */
const useFace = async (page, face) => {
  if (face === "site") {
    await gotoReady(page, "/");
    await page.evaluate(() => Promise.all([document.fonts.load("12px kraken"), document.fonts.load("700 12px kraken")]));
  } else if (face === "matched") await page.route(/\.woff2(\?|$)/, (route) => route.abort());
};

const cases = [
  { width: 320, title: "주소로 캐릭터를 불러와도", long: false },
  { width: 1280, title: "주소로 캐릭터를 불러와도", long: false },
  { width: 320, title: "가장 긴 이름 · 서버를 불러와도(사이트 글꼴)", long: true, face: "site" },
  { width: 320, title: "가장 긴 이름 · 서버를 불러와도(맞춘 대체 글꼴)", long: true, face: "matched" },
];

for (const { width, title, long, face } of cases)
  test(`${width}: ${title} 캐릭터 장비 카드 높이와 아래 카드 자리가 그대로다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    if (face) await useFace(page, face);
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route("**/api/characters?*", async (route) => {
      await held;
      if (!long) return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      const envelope = body.envelope ?? body;
      Object.assign(envelope.data, { characterName: LONG_NAME, serverName: LONG_SERVER });
      await route.fulfill({ response, json: body });
    });
    await page.goto(`/tools/refining?character=${encodeURIComponent("재련")}`);
    const loader = page.locator("section", { has: page.getByRole("heading", { name: "캐릭터 장비" }) });
    const target = page.locator("section", { has: page.getByRole("heading", { name: "목표 단계" }) });
    await expect(page.getByRole("button", { name: "불러오는 중…" })).toBeVisible();
    const box = async () => {
      const [a, b] = await Promise.all([loader.boundingBox(), target.boundingBox()]);
      return { loaderHeight: Math.round(a.height * 10) / 10, targetY: Math.round(b.y * 10) / 10 };
    };
    // Settled before the answer (fonts, first paint): what moves from here is the character.
    await page.waitForTimeout(600);
    const before = await box();
    const mark = await shiftMark(page);

    release();
    const line = long
      ? `${LONG_NAME} · ${LONG_SERVER} · 아이템 레벨 1,738.33`
      : "재련 · 루페온 · 아이템 레벨 1,738.33";
    await expect(page.getByRole("status").filter({ hasText: line })).toBeVisible();
    await expect(page.getByRole("group", { name: "무기" }).getByRole("combobox", { name: "현재" })).toHaveText("+21");
    await page.waitForTimeout(400);
    // The face this leg names is the one drawn, measured by width (a fallback slipping in would prove the wrong fit).
    if (face) expect(await drawnFace(page), "그리는 글꼴").toBe(face);
    const after = await box();
    expect(after.loaderHeight, `캐릭터 장비 카드 높이 ${before.loaderHeight} → ${after.loaderHeight}`).toBe(before.loaderHeight);
    expect(after.targetY, `목표 단계 카드 자리 ${before.targetY} → ${after.targetY}`).toBe(before.targetY);
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
