// 회귀(사용자 11-01): 홈·소개 히어로의 봇. 히어로 어디서든 포인터를 따라 보고,
// 봇·배경·제목·검색창을 눌러도 따라보기는 멈추지 않는다(봇을 누르면 자동 움직임만
// 멈춤). 마지막 움직임 5초 뒤에는 쉬는 자세로 그리기를 멈춘다(유휴 프레임 0).
// 줄어든 모션은 정지 그림 하나. 첫 HTML부터 같은 상자라 라이브러리가 늦게 와도,
// '봇 바꾸기'로 몸을 바꿔도 흔들림 0이고, 바꾸는 순간 빈 그림이 끼지 않는다.
// 고른 봇은 기억된다. 테두리(원)는 없다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince, shiftsDuring } from "../support/shifts.mjs";

const hero = (page) => page.locator('section[aria-labelledby="hero-heading"]');
const bot = (page) => hero(page).locator("[data-bot]");
const canvas = (page) => bot(page).locator("canvas");
const pause = (page) => page.getByRole("button", { name: "애니메이션 멈춤" });

/** Where the bot looks: [yaw, pitch] in radians (yaw > 0 = to the viewer's right). */
const turn = async (page) => {
  const value = await canvas(page).getAttribute("data-bot-turn");
  expect(value, "봇이 한 번은 그려져야 한다").not.toBeNull();
  return value.split(",").map(Number);
};

async function desktop(page, path = "/") {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await gotoReady(page, path);
  await expect(canvas(page)).toHaveAttribute("data-bot-turn", /,/);
}

async function followsHorizontally(page) {
  const area = await hero(page).boundingBox();
  const box = await bot(page).boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(area.x + 4, y, { steps: 12 });
  await expect.poll(async () => (await turn(page))[0]).toBeLessThan(-0.2);
  await page.mouse.move(area.x + area.width - 4, y, { steps: 12 });
  await expect.poll(async () => (await turn(page))[0]).toBeGreaterThan(0.2);
}

test.describe("히어로 봇 @regression", () => {
  for (const path of ["/", "/about"]) {
    test(`${path}: 히어로 안 고정 상자, 장식으로 숨김, 테두리 없음`, async ({ page }) => {
      await desktop(page, path);
      const html = await (await page.request.get(path)).text();
      expect(html, "서버 HTML부터 기본 봇의 상자").toContain('data-bot="clover"');
      await expect(bot(page)).toHaveAttribute("aria-hidden", "true");
      const box = await bot(page).boundingBox();
      expect(box.width).toBe(150);
      expect(box.height).toBe(150);
      // 원 테두리 없음: 무대에 테두리도 원형 장식도 그리지 않는다.
      const stage = await pause(page).evaluate((el) => {
        const before = getComputedStyle(el, "::before");
        return { border: getComputedStyle(el).borderTopWidth, beforeBorder: before.borderTopWidth };
      });
      expect(stage).toEqual({ border: "0px", beforeBorder: "0px" });
      // 홈의 `.page button { font: inherit }`(0,1,1)에 지지 않고 작은 글씨 그대로.
      await expect(page.getByRole("button", { name: "봇 바꾸기" })).toHaveCSS("font-size", "12px");
    });
  }

  test("히어로 좌우·위아래의 포인터를 따라 본다", async ({ page }) => {
    await desktop(page);
    await followsHorizontally(page);
    const area = await hero(page).boundingBox();
    const box = await bot(page).boundingBox();
    const x = box.x + box.width / 2;
    await page.mouse.move(x, area.y + 4, { steps: 12 });
    const up = await expect.poll(async () => (await turn(page))[1]).toBeGreaterThan(0.1).then(() => turn(page));
    await page.mouse.move(x, area.y + area.height - 4, { steps: 12 });
    await expect.poll(async () => (await turn(page))[1]).toBeLessThan(up[1] - 0.2);
  });

  test("봇·배경·제목·검색창을 누른 뒤에도 계속 따라 본다", async ({ page }) => {
    await desktop(page);
    await bot(page).click();
    await expect(pause(page)).toHaveAttribute("aria-pressed", "true");
    await followsHorizontally(page);
    await bot(page).click();
    await expect(pause(page)).toHaveAttribute("aria-pressed", "false");
    await followsHorizontally(page);

    const area = await hero(page).boundingBox();
    await page.mouse.click(area.x + 4, area.y + area.height / 2);
    await followsHorizontally(page);
    await page.locator("#hero-heading").click();
    await followsHorizontally(page);
    await page.getByRole("textbox", { name: "캐릭터 이름", exact: true }).click();
    await followsHorizontally(page);
    await page.locator("#hero-heading").click();
    await page.mouse.down();
    await followsHorizontally(page);
    await page.mouse.up();
    await followsHorizontally(page);
  });

  test("움직임이 멎고 5초 뒤 그리기를 멈추고, 다음 움직임에 깨어난다", async ({ page }) => {
    await desktop(page);
    await followsHorizontally(page);
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "running");
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked", { timeout: 9000 });
    // 쉬는 동안 한 번도 그리지 않는다(유휴 프레임 0).
    const draws = await canvas(page).evaluate(async (el) => {
      const ctx = el.getContext("2d");
      let n = 0;
      const clear = ctx.clearRect;
      ctx.clearRect = function (...args) { n++; return clear.apply(this, args); };
      await new Promise((resolve) => setTimeout(resolve, 1500));
      ctx.clearRect = clear;
      return n;
    });
    expect(draws).toBe(0);
    const area = await hero(page).boundingBox();
    await page.mouse.move(area.x + 4, area.y + area.height / 2);
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "running");
  });

  test("봇 그림 코드는 첫 로드에 없다: 페이지 로드 뒤 쉴 때 받아 그린다", async ({ page }) => {
    // 그림 코드에만 있는 낱말(모자 이름)로 그 조각을 알아본다.
    const scripts = [];
    page.on("response", async (response) => {
      if (response.request().resourceType() !== "script") return;
      const body = await response.text().catch(() => "");
      scripts.push({ at: response.request().timing().startTime, bot: body.includes('"beanie"') });
    });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/", { waitUntil: "load" });
    const loaded = Date.now();
    await expect(canvas(page)).toHaveAttribute("data-bot-turn", /,/, { timeout: 8000 });
    const bot = scripts.filter((s) => s.bot);
    expect(bot.length, "그림 코드 조각은 한 번").toBe(1);
    expect(bot[0].at, "load 뒤에 받는다").toBeGreaterThanOrEqual(loaded);
  });

  test("줄어든 모션: 멈춤 버튼 없이 정지 그림 하나", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoReady(page, "/");
    await expect(canvas(page)).toHaveAttribute("data-bot-turn", /,/);
    await expect(pause(page)).toHaveCount(0);
    const before = await turn(page);
    const seen = await canvas(page).evaluateHandle((el) => {
      const values = [el.dataset.botLoop];
      const observer = new MutationObserver(() => values.push(el.dataset.botLoop));
      observer.observe(el, { attributes: true, attributeFilter: ["data-bot-loop"] });
      return { values, observer };
    });
    const area = await hero(page).boundingBox();
    await page.mouse.move(area.x + 4, area.y + 200);
    await page.mouse.move(area.x + area.width - 4, area.y + 200, { steps: 12 });
    const values = await seen.evaluate(async ({ values, observer }) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      observer.disconnect();
      return values;
    });
    await seen.dispose();
    expect(values.every((value) => value === "parked")).toBe(true);
    expect(await turn(page)).toEqual(before);
  });

  test("봇 바꾸기: 키보드로 고르고, 흔들림·빈 그림 없이 바뀌고, 새로고침 뒤에도 기억", async ({ page }) => {
    await watchShifts(page);
    await desktop(page);
    await page.getByRole("button", { name: "봇 바꾸기" }).click();
    const group = page.getByRole("radiogroup", { name: "봇 모양" });
    await expect(group.getByRole("radio")).toHaveCount(18);
    await expect(group.getByRole("radio", { name: "클로버" })).toBeFocused();
    await expect(group.getByRole("radio", { name: "클로버" })).toHaveAttribute("aria-checked", "true");

    // 바뀌는 동안 매 프레임 봇 가운데가 비지 않는지 기록한다.
    await canvas(page).evaluate((el) => {
      const ctx = el.getContext("2d");
      window.__blank = 0;
      window.__frames = 0;
      const sample = () => {
        const { data } = ctx.getImageData(el.width / 2, el.height * 0.55, 1, 1);
        window.__frames++;
        if (data[3] === 0) window.__blank++;
        if (window.__frames < 40) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const shifts = await shiftsDuring(page, () => page.keyboard.press("ArrowRight"), 800);
    expect(shifts.all, shifts.moved).toBe(0);
    await expect(group.getByRole("radio", { name: "꽃" })).toHaveAttribute("aria-checked", "true");
    await expect(group.getByRole("radio", { name: "꽃" })).toBeFocused();
    await expect(bot(page)).toHaveAttribute("data-bot", "flower");
    await expect.poll(() => page.evaluate(() => window.__frames)).toBeGreaterThanOrEqual(40);
    expect(await page.evaluate(() => window.__blank)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem("loakraken-bot"))).toBe("flower");

    await page.keyboard.press("Escape");
    await expect(group).toBeHidden();
    await page.reload();
    await expect(bot(page)).toHaveAttribute("data-bot", "flower");
    await expect((await bot(page).boundingBox()).width).toBe(150);
  });
});

for (const theme of ["light", "dark"]) {
  for (const width of [320, 360, 1280]) {
    const tags = width < 400 ? "@smoke @regression" : "@regression";
    test(`${width}px ${theme}: 첫 그림부터 봇 상자 고정·흔들림 0 ${tags}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((value) => localStorage.setItem("loakraken-theme", value), theme);
      await watchShifts(page);
      await gotoReady(page, "/");
      // 라이브러리가 도착해 첫 그림을 그린 뒤까지 본다.
      await expect(canvas(page)).toHaveAttribute("data-bot-turn", /,/);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => setTimeout(resolve, 850));
      });
      const shifts = await shiftsSince(page);
      expect(shifts.all, shifts.moved).toBe(0);
      if (width === 320) await expectNoHorizontalOverflow(page);
      const box = await bot(page).boundingBox();
      expect(box.width).toBe(width <= 760 ? 132 : 150);
      expect(box.height).toBe(box.width);
    });
  }
}
