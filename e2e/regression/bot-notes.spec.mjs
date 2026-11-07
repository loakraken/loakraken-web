// 회귀(사용자 11-04): 비었거나 실패한 화면의 말 옆에 작은 봇(방문자가 고른 몸·모자·안경). 봇은 말을
// 바꾸지 않고 옆에 서며, 화면 읽기에서는 숨는다. 고정된 56px 칸이라 흔들림 0, 320에서 글이 잘리지 않는다.
// 기분: 못 찾음(시세 검색 결과 없음·랭킹 0줄·캐릭터 없음) = 갸우뚱, 조회가 늦거나 실패함 = 잠든 자세,
// 즐겨찾기가 비었음 = 그대로(잠들지 않음).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince } from "../support/shifts.mjs";

const STATES = [
  { name: "시세 검색 결과 없음", path: "/market?q=zzz", mood: "puzzled", text: "‘zzz’에 맞는 품목이 이 분류에 없어요. 다른 분류에서 찾아볼까요?" },
  { name: "랭킹 0줄", path: "/rankings?type=gems&className=%ED%99%98%EC%88%98%EC%82%AC", mood: "puzzled", text: "조건에 맞는 캐릭터가 없어요. 조건을 조금 넓혀 볼까요?" },
  // The favourites bar is one fixed 30px row (saved favourites replace it after loading): a one-line note.
  { name: "시세 즐겨찾기 없음", path: "/market", mood: "calm", text: "표시를 누르면 여기에 모여요", inline: true },
  { name: "캐릭터 없음", path: `/character/${encodeURIComponent("미존재")}`, mood: "puzzled", text: "이름을 한 번 더 확인하고 다시 검색해 볼까요?" },
  { name: "조회 늦음", path: `/character/${encodeURIComponent("시간초과")}`, mood: "asleep", text: "조회가 조금 오래 걸리고 있어요. 잠시 뒤 다시 시도해 주세요." },
];

// A 404 answer (the character not found) logs a resource error by design.
test.use({ allowConsoleErrors: true });

for (const state of STATES)
  for (const width of [320, 1280])
    test(`${state.name} ${width}: 말 옆의 봇, 고정 칸·숨김·흔들림 0·잘림 없음 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, state.path);
      const note = page.locator(`[data-bot-note="${state.mood}"]`).filter({ hasText: state.text });
      await expect(note).toHaveCount(1);
      await note.scrollIntoViewIfNeeded();
      // The copy is read as before; the bot is hidden from assistive tech.
      await expect(note.getByText(state.text)).toBeVisible();
      await expect(note.locator("[data-bot]")).toHaveAttribute("aria-hidden", "true");
      const box = await note.locator("[data-bot]").boundingBox();
      const size = state.inline ? 28 : 56;
      expect([Math.round(box.width), Math.round(box.height)]).toEqual([size, size]);
      // Phones: the bot above the copy; wide (and a one-line note at every width): beside it.
      const copy = await note.locator("> div").last().boundingBox();
      if (width <= 600 && !state.inline) expect(copy.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
      else expect(copy.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
      // A one-line note fits its row: the note is no taller than 30px and its text is not cut either way.
      if (state.inline) {
        expect(Math.round((await note.boundingBox()).height)).toBeLessThanOrEqual(30);
        const fits = await note.locator("p").evaluate((p) => [p.scrollWidth <= p.clientWidth + 1, p.scrollHeight <= p.clientHeight + 1]);
        expect(fits, "한 줄 안내가 줄 안에 다 보임").toEqual([true, true]);
      }
      // The drawing arrives in the fixed box, then rests still.
      await expect(note.locator("canvas")).toHaveAttribute("data-bot-turn", /,/, { timeout: 8000 });
      await expect(note.locator("canvas")).toHaveAttribute("data-bot-loop", "parked", { timeout: 8000 });
      if (state.mood === "puzzled") expect(Number(await note.locator("canvas").getAttribute("data-bot-tilts"))).toBe(1);
      if (state.mood === "calm") await expect(note.locator("canvas")).toHaveAttribute("data-bot-rest", "awake");
      // No cut text in the note (A37).
      // The bot's own box is left out: its canvas draws past it on purpose (hops, turns).
      const cut = await note.evaluate((root) => [...root.querySelectorAll("p, h2, strong, span")]
        .filter((el) => !el.closest("[data-bot]") && !el.querySelector("[data-bot]"))
        .filter((el) => getComputedStyle(el).display !== "inline" && el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent));
      expect(cut).toEqual([]);
      await expectNoHorizontalOverflow(page);
      const shift = await shiftsSince(page);
      expect(shift.all, `흔들림 (${shift.moved})`).toBe(0);
    });

test("줄인 동작: 말 옆의 봇은 정지 그림, 갸우뚱 없음 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoReady(page, "/market?q=zzz");
  const canvas = page.locator('[data-bot-note="puzzled"] canvas');
  await expect(canvas).toHaveAttribute("data-bot-turn", /,/, { timeout: 8000 });
  await page.waitForTimeout(800);
  await expect(canvas).toHaveAttribute("data-bot-loop", "parked");
  expect(await canvas.getAttribute("data-bot-tilts")).toBeNull();
});
