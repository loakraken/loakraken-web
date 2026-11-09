// 회귀(사용자 11-03): 히어로 봇이 검색칸에 초점이 있는 동안 검색칸을 내려다보고 그 자리에 멈춰 있다
// (포인터·글자 입력으로 움직이지 않고, 잠들지 않음, 초점을 잃으면 다시 따라 봄). 멈춤·줄인 동작은
// 내려다보는 정지 그림. 이름 형식이 틀리면 고개를 한 번 갸우뚱(0.7초 안, 그 뒤 고개 바로, 멈춤·줄인 동작은 없음).
// '봇 바꾸기'에 모자·안경 줄(bot-avatars의 선택지)이 있고, 고르면 바로 입고 닫히며 뛰지 않고,
// 새로고침 뒤에도 기억. 창을 열어도 흔들림 0(320·1280).
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince, shiftMark } from "../support/shifts.mjs";

const hero = (page) => page.locator('section[aria-labelledby="hero-heading"]');
const bot = (page) => hero(page).locator("[data-bot]");
const canvas = (page) => bot(page).locator("canvas");
const pause = (page) => page.getByRole("button", { name: "애니메이션 멈춤" });
const box = (page) => page.getByRole("textbox", { name: "캐릭터 이름", exact: true });
const turn = async (page) => (await canvas(page).getAttribute("data-bot-turn")).split(",").map(Number);
// Where the eyes look (lookX, lookY: -1 … 1, down positive), in tenths.
const eyes = async (page) => (await canvas(page).getAttribute("data-bot-look")).split(",").map(Number);
const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];
// The settled aim (head yaw·pitch, eyes x·y): 7 readings 150 ms apart, medians.
async function settledAim(page, nudge) {
  await page.waitForTimeout(500);
  const rows = [];
  for (let i = 0; i < 7; i++) {
    await page.waitForTimeout(150);
    if (nudge) await nudge(i);
    rows.push([...(await turn(page)), ...(await eyes(page))]);
  }
  return [0, 1, 2, 3].map((k) => median(rows.map((row) => row[k])));
}
// The point it turns to, in the library's reach units (written on focus and pointer events).
const aimOf = async (page) => (await canvas(page).getAttribute("data-bot-aim")).split(",").map(Number);
const hops = async (page) => Number((await canvas(page).getAttribute("data-bot-hops")) ?? 0);
const tilts = async (page) => Number((await canvas(page).getAttribute("data-bot-tilts")) ?? 0);
const search = (page) => hero(page).getByRole("button", { name: "캐릭터 검색" });

// 그린 시각을 모은다(캔버스의 clearRect = 한 번 그림): 갸우뚱이 한 번에 바뀌지 않고 프레임마다 그려지는지 본다.
async function watchDraws(page) {
  await canvas(page).evaluate((el) => {
    window.__draws = [];
    const ctx = el.getContext("2d");
    const clear = ctx.clearRect;
    ctx.clearRect = function (...args) { window.__draws.push(performance.now()); return clear.apply(this, args); };
  });
}

async function desktop(page, width = 1280) {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await gotoReady(page, "/");
  await expect(canvas(page)).toHaveAttribute("data-bot-turn", /,/);
}

test.describe("히어로 봇: 검색칸 보기·모자·안경 @regression", () => {
  // 글자를 치지 않고 커서만 옮겨도 봇은 커서 자리를 본다. 키를 뗄 때(keyup)가 아니라 커서 이동
  // (selectionchange)으로 듣는다(#1480). 커서는 키 없이 setSelectionRange로 옮겨, keyup만 듣는
  // 코드로는 이 검사가 통과하지 못한다.
  test("검색칸에서 커서만 옮겨도 커서 자리를 본다", async ({ page }) => {
    await desktop(page);
    const x = async () => (await aimOf(page))[0];
    await box(page).click();
    const empty = await x();
    await box(page).fill("가나다라마바사아자차카타파하가나다라마바");
    // Typing moves the aim along with the caret (input).
    await expect.poll(x, { message: "글자를 치면 커서를 따라 오른쪽" }).toBeGreaterThan(empty);
    // The caret moved with no key event at all (no keyup to hear).
    const caretTo = (at) => box(page).evaluate((el, at) => el.setSelectionRange(at === "end" ? el.value.length : 0, at === "end" ? el.value.length : 0), at);
    const atEnd = await x();
    await caretTo("start");
    await expect.poll(x, { message: "커서만 왼쪽 끝으로: 그 자리를 봄" }).toBeLessThan(atEnd);
    const atStart = await x();
    await caretTo("end");
    await expect.poll(x, { message: "커서만 오른쪽 끝으로: 다시 오른쪽" }).toBeGreaterThan(atStart);
  });

  test("검색칸에 초점이 있으면 포인터가 검색칸 글자 자리에 있을 때와 똑같이 본다", async ({ page }) => {
    test.setTimeout(60_000);
    await desktop(page);
    // 빈 검색칸의 글자 자리(안쪽 왼쪽 끝, 세로 가운데)에 포인터를 두었을 때의 멈춘 자세.
    const start = await box(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { x: r.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft), y: r.top + r.height / 2 };
    });
    await page.mouse.move(start.x, start.y, { steps: 8 });
    const pointed = await settledAim(page, (i) => page.mouse.move(start.x + (i % 2), start.y));
    await page.mouse.move(start.x, start.y);
    const pointedAim = await aimOf(page);
    // 포인터를 위로 옮긴 뒤 키보드로 초점: 고개는 포인터가 아니라 그 글자 자리를 본다.
    const area = await hero(page).boundingBox();
    await page.mouse.move(start.x, area.y + 4, { steps: 8 });
    const upAim = await aimOf(page);
    await box(page).focus();
    // The focus aim is written by an effect after focus(): wait until it replaces the pointer's.
    await expect.poll(() => aimOf(page), { message: "초점의 겨누는 점이 적힘" }).not.toEqual(upAim);
    const focusedAim = await aimOf(page);
    // The hop and the live pose fade out, then the loop parks on the look.
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked", { timeout: 10_000 });
    const focused = await settledAim(page);
    // 겨누는 점(라이브러리 reach 단위)이 포인터를 그 자리에 둔 때와 같다.
    // (CI 11-08: 살아 있는 포인터 자세는 라이브러리의 혼자 고개 돌리기·곁눈질·뜀이 섞여 멈춘 자세와 0.3까지
    // 달랐다. 그래서 자세끼리가 아니라 겨누는 점을 비교하고, 멈춘 자세는 라이브러리의 포인터 규칙으로 본다.)
    for (let k = 0; k < 2; k++)
      expect(Math.abs(focusedAim[k] - pointedAim[k]), `겨누는 점: 초점 ${focusedAim} · 포인터 ${pointedAim}`).toBeLessThanOrEqual(0.02);
    // 멈춘 자세 = 라이브러리가 강도 1의 포인터에 쓰는 규칙(고개 22°·눈 4.5, 아래로 12°·눈 3 / reach 1).
    // 허용 = 적힌 자릿수만: 자세는 소수 한 자리(±0.05), 겨누는 점은 두 자리(±0.005 × 각 배율).
    const deg = Math.PI / 180;
    const gain = [22 * deg, 12 * deg, 4.5, 3];
    const want = [focusedAim[0] * gain[0], -focusedAim[1] * gain[1], focusedAim[0] * gain[2], focusedAim[1] * gain[3]];
    for (let k = 0; k < 4; k++)
      expect(Math.abs(focused[k] - want[k]), `멈춘 자세 ${focused} · 규칙 ${want.map((v) => v.toFixed(3))}`).toBeLessThanOrEqual(0.05 + 0.005 * gain[k] + 1e-9);
    // 살아 있는 포인터 자세와도 같은 쪽(왼쪽 아래)을 본다.
    expect(Math.sign(pointed[0]), `포인터 ${pointed}`).toBe(Math.sign(focused[0]));
    expect(focused[3], "아래(검색칸)를 봄").toBeGreaterThanOrEqual(0.2);
  });

  test("글자를 치면 눈이 글자 끝을 따라가고, 지우면 돌아오고, 치기를 멈추면 멈춘다", async ({ page }) => {
    test.setTimeout(60_000);
    await desktop(page);
    // 멈춘 뒤의 자세는 흔들림·곁눈질이 없어 정확히 잴 수 있다: 단계마다 멈출 때까지 기다린다.
    const parked = async () => {
      await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked", { timeout: 9000 });
      return [...(await turn(page)), ...(await eyes(page))];
    };
    await box(page).focus();
    const empty = await parked();
    await page.keyboard.type("가나다라마바", { delay: 80 });
    const six = await parked();
    expect(six[2], `여섯 글자 뒤 눈이 오른쪽으로 (${empty[2]} → ${six[2]})`).toBeGreaterThanOrEqual(empty[2] + 0.1);
    for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");
    const three = await parked();
    expect(three[2], `세 글자 지우면 돌아옴 (${six[2]} → ${three[2]})`).toBeLessThan(six[2]);
    expect(three[2]).toBeGreaterThanOrEqual(empty[2]);
    // 치기를 멈추면 그리기를 멈춘다(끝없는 움직임 없음).
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked", { timeout: 8000 });
  });

  test("검색칸에 초점이 있으면 포인터·글자 입력에도 그 자리에 멈추고 잠들지 않으며, 초점을 잃으면 다시 따라 본다", async ({ page }) => {
    test.setTimeout(60_000);
    await desktop(page);
    const area = await hero(page).boundingBox();
    const center = await bot(page).boundingBox();
    const x = center.x + center.width / 2;
    await box(page).focus();
    await expect.poll(async () => (await eyes(page))[1], { message: "검색칸을 내려다봄(눈)" }).toBeGreaterThanOrEqual(0.2);
    // 포인터를 움직이고 글자를 쳐도 고개는 그대로, 쉬는 시간 뒤 멈추고 잠들지 않는다.
    await page.mouse.move(x, area.y + 4, { steps: 8 });
    await page.keyboard.type("테스트", { delay: 60 });
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked", { timeout: 9000 });
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "awake");
    expect((await eyes(page))[1], "멈춘 자세도 내려다봄(눈)").toBeGreaterThanOrEqual(0.2);
    await page.waitForTimeout(1500);
    await expect(canvas(page), "초점이 있으면 잠들지 않음").toHaveAttribute("data-bot-rest", "awake");
    // 초점을 잃으면 다시 포인터를 따라 본다(위).
    await page.locator("#hero-heading").click();
    await page.mouse.move(x, area.y + 4, { steps: 8 });
    await expect.poll(async () => (await turn(page))[1], { message: "초점을 잃으면 다시 위를 봄" }).toBeGreaterThan(0);
  });

  test("이름 형식이 틀리면 한 번 갸우뚱하고 0.7초 안에 끝난다, 오류마다 한 번", async ({ page }) => {
    await desktop(page);
    await page.route(/\/character\//, () => {});
    await box(page).fill("이름!");
    await watchDraws(page);
    const t0 = await page.evaluate(() => performance.now());
    await search(page).click();
    await expect(page.getByText("캐릭터 이름에는 문자와 숫자만 사용할 수 있어요.")).toBeVisible();
    await expect.poll(() => tilts(page), { message: "오류에 한 번" }).toBe(1);
    // 오류가 검색칸에 초점을 되돌려도 뛰지 않는다(갸우뚱만, 사용자가 누른 초점이 아님).
    const hopped = await hops(page);
    // 갸우뚱하는 동안 매 프레임 그린다(한 번에 바뀌지 않음).
    await page.waitForTimeout(900);
    const frames = await page.evaluate((start) => window.__draws.filter((t) => t >= start && t <= start + 700).length, t0);
    expect(frames, "갸우뚱 프레임").toBeGreaterThanOrEqual(10);
    expect(await tilts(page), "한 번만").toBe(1);
    expect(await hops(page), "오류에는 뛰지 않음").toBe(hopped);
    // 같은 틀린 이름을 다시 보내면 또 한 번.
    await search(page).click();
    await expect.poll(() => tilts(page), { message: "다음 오류에 또 한 번" }).toBe(2);
  });

  test("멈춘 채 이름 형식이 틀려도 갸우뚱하지 않는다", async ({ page }) => {
    await desktop(page);
    await pause(page).focus();
    await page.keyboard.press("Enter");
    await expect(pause(page)).toHaveAttribute("aria-pressed", "true");
    await box(page).focus();
    await page.keyboard.type("이름!");
    await page.keyboard.press("Enter");
    await expect(page.getByText("캐릭터 이름에는 문자와 숫자만 사용할 수 있어요.")).toBeVisible();
    await page.waitForTimeout(800);
    expect(await tilts(page)).toBe(0);
  });

  test("멈춘 채 초점: 내려다보는 정지 그림 한 번, 뛰지 않음", async ({ page }) => {
    await desktop(page);
    await pause(page).focus();
    await page.keyboard.press("Enter");
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked", { timeout: 9000 });
    const before = await hops(page);
    await box(page).focus();
    await expect.poll(async () => (await eyes(page))[1], { message: "멈춘 채 내려다봄(눈)" }).toBeGreaterThanOrEqual(0.2);
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked");
    expect(await hops(page)).toBe(before);
  });

  test("줄인 동작: 초점이 오면 내려다보는 정지 그림", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoReady(page, "/");
    await expect(canvas(page)).toHaveAttribute("data-bot-turn", "0.0,0.0");
    await box(page).focus();
    await expect.poll(async () => (await eyes(page))[1], { message: "줄인 동작도 내려다봄(눈)" }).toBeGreaterThanOrEqual(0.2);
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked");
    await page.keyboard.type("이름!");
    await page.keyboard.press("Enter");
    await expect(page.getByText("캐릭터 이름에는 문자와 숫자만 사용할 수 있어요.")).toBeVisible();
    await page.waitForTimeout(600);
    expect(await tilts(page), "줄인 동작은 갸우뚱 없음").toBe(0);
    await page.locator("#hero-heading").click();
    await expect(canvas(page)).toHaveAttribute("data-bot-turn", "0.0,0.0");
  });

  for (const width of [320, 360, 390])
    test(`${width} 봇 바꾸기 창은 머리글 아래에 머물고, 넘치면 안에서 스크롤`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await watchShifts(page);
      await gotoReady(page, "/");
      const mark = await shiftMark(page);
      await page.getByRole("button", { name: "봇 바꾸기" }).click();
      const grid = page.getByRole("radiogroup", { name: "봇 모양" });
      await expect(grid).toBeVisible();
      const popup = grid.locator("xpath=..");
      const header = await page.locator("header").first().boundingBox();
      const r = await popup.boundingBox();
      expect(r.y, "머리글을 덮지 않음").toBeGreaterThanOrEqual(header.y + header.height);
      expect(r.y + r.height, "화면 아래로 넘치지 않음").toBeLessThanOrEqual(800);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(width);
      // 안경 줄까지 닿는다(넘치면 창 안에서 스크롤).
      await page.getByRole("radiogroup", { name: "안경" }).getByRole("radio", { name: "선글라스" }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("radiogroup", { name: "안경" }).getByRole("radio", { name: "선글라스" })).toBeInViewport();
      const shift = await shiftsSince(page, mark);
      expect(shift.all, `창 열기 흔들림 (${shift.moved})`).toBe(0);
    });

  test("몸을 바꾸면 모자·안경 미리 보기도 새 몸으로, 몸 칸은 고른 모자·안경을 그대로", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("loakraken-bot-wear", "crown shades"));
    await gotoReady(page, "/");
    await page.getByRole("button", { name: "봇 바꾸기" }).click();
    const wearThumbs = page.locator("[data-bot-wear] [data-thumb]");
    await expect(wearThumbs).toHaveCount(9);
    expect(new Set(await wearThumbs.evaluateAll((els) => els.map((el) => el.dataset.thumb)))).toEqual(new Set(["clover"]));
    // 화살표로 몸을 바꾸면(창은 열린 채) 아래 두 줄이 새 몸으로 다시 그려진다.
    await page.getByRole("radiogroup", { name: "봇 모양" }).getByRole("radio", { name: "클로버" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radiogroup", { name: "봇 모양" }).getByRole("radio", { name: "꽃" })).toHaveAttribute("aria-checked", "true");
    await expect.poll(async () => [...new Set(await wearThumbs.evaluateAll((els) => els.map((el) => el.dataset.thumb)))]).toEqual(["flower"]);
    // 모자·안경 칸의 그림이 실제로 다시 그려졌다(빈 캔버스 아님).
    const drawn = await page.locator('[data-bot-wear="crown"] canvas').evaluate((el) => {
      const { data } = el.getContext("2d").getImageData(0, 0, el.width, el.height);
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
      return false;
    });
    expect(drawn).toBe(true);
    // 몸 칸은 고른 모자·안경을 입은 채.
    await expect(page.getByRole("radiogroup", { name: "모자" }).getByRole("radio", { name: "왕관" })).toHaveAttribute("aria-checked", "true");
  });

  for (const width of [320, 1280])
    test(`${width} 봇 바꾸기의 모자·안경: 고르면 바로 입고 닫힘, 뛰지 않음, 새로고침 뒤에도 기억, 흔들림 0`, async ({ page }) => {
      await watchShifts(page);
      await desktop(page, width);
      const mark = await shiftMark(page);
      const trigger = page.getByRole("button", { name: "봇 바꾸기" });
      await trigger.click();
      const hats = page.getByRole("radiogroup", { name: "모자" });
      const glasses = page.getByRole("radiogroup", { name: "안경" });
      await expect(hats.getByRole("radio")).toHaveCount(5);
      await expect(glasses.getByRole("radio")).toHaveCount(4);
      await expect(hats.getByRole("radio", { name: "없음" })).toHaveAttribute("aria-checked", "true");
      // 창은 화면 안에 다 들어간다.
      const popup = await page.getByRole("radiogroup", { name: "봇 모양" }).locator("xpath=..").boundingBox();
      expect(popup.x).toBeGreaterThanOrEqual(0);
      expect(popup.x + popup.width).toBeLessThanOrEqual(width);
      const before = await hops(page);
      await hats.getByRole("radio", { name: "베레모" }).click();
      await expect(hats).toBeHidden();
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => localStorage.getItem("loakraken-bot-wear"))).toBe("beret none");
      await trigger.click();
      await glasses.getByRole("radio", { name: "선글라스" }).click();
      expect(await page.evaluate(() => localStorage.getItem("loakraken-bot-wear"))).toBe("beret shades");
      await page.waitForTimeout(600);
      expect(await hops(page), "입을 때는 뛰지 않음").toBe(before);
      const shift = await shiftsSince(page, mark);
      expect(shift.all, `창 열기·고르기 흔들림 (${shift.moved})`).toBe(0);
      await page.reload();
      await trigger.click();
      await expect(hats.getByRole("radio", { name: "베레모" })).toHaveAttribute("aria-checked", "true");
      await expect(glasses.getByRole("radio", { name: "선글라스" })).toHaveAttribute("aria-checked", "true");
      // 화살표는 고르기만 하고 창은 열린 채.
      await hats.getByRole("radio", { name: "베레모" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(hats.getByRole("radio", { name: "비니" })).toHaveAttribute("aria-checked", "true");
      await expect(hats).toBeVisible();
    });
});
