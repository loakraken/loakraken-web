// 회귀(사용자 11-01, 11-02): 홈·소개 히어로의 봇. 창 어디서든(머리글 포함) 포인터를 따라 보고,
// 봇·배경·제목·검색창을 눌러도 따라보기는 멈추지 않는다(봇을 누르면 자동 움직임만
// 멈춤). 마지막 움직임 5초 뒤에는 잠든 자세(눈 감고 고개 숙임)로 그리기를 멈추고
// (유휴 프레임 0), 다음 움직임에 깨어난다. 멈춤 상태면 깬 채로 쉰다. 뛰는 것은
// 사용자가 한 일에 한 번씩만: 깨어날 때, 검색칸 초점, 봇 바꾸기(한 바퀴). 멈춤·줄어든
// 모션에서는 뛰지 않는다.
// 줄어든 모션은 정지 그림 하나(눈 뜬 기본 자세). 첫 HTML부터 같은 상자라 라이브러리가 늦게 와도,
// '봇 바꾸기'로 몸을 바꿔도 흔들림 0이고, 바꾸는 순간 빈 그림이 끼지 않는다.
// 고른 봇은 기억된다. 테두리(원)는 없다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince, shiftsDuring } from "../support/shifts.mjs";

const hero = (page) => page.locator('section[aria-labelledby="hero-heading"]');
const bot = (page) => hero(page).locator("[data-bot]");
const canvas = (page) => bot(page).locator("canvas");
const pause = (page) => page.getByRole("button", { name: "애니메이션 멈춤" });

/** Turned toward a side: |yaw| past this (yaw comes rounded to 0.1). */
const FOLLOW = 0.2;

/** Where the bot looks: [yaw, pitch] in radians (yaw > 0 = to the viewer's right). */
const turn = async (page) => {
  const value = await canvas(page).getAttribute("data-bot-turn");
  expect(value, "봇이 한 번은 그려져야 한다").not.toBeNull();
  return value.split(",").map(Number);
};

/** How many one-shot hops the bot has made on this page (each answers a visitor's action). */
const hops = async (page) => Number((await canvas(page).getAttribute("data-bot-hops")) ?? 0);

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
  await expect.poll(async () => (await turn(page))[0]).toBeLessThan(-FOLLOW);
  await page.mouse.move(area.x + area.width - 4, y, { steps: 12 });
  await expect.poll(async () => (await turn(page))[0]).toBeGreaterThan(FOLLOW);
}

// 포인터를 (x, y)에 둔 채 멈춘 고개 위아래 값. 1px씩 살짝 움직여 봇을 깨어 있게 하고(쉬는 5초가
// 다시 시작됨), 7번 읽은 값의 중앙값으로 라이브러리의 느린 고개 흔들림을 걸러 낸다. 한 번 맞은 값이
// 아니라 중앙값을 보므로, 따라보지 않고 흔들리기만 하는 고개는 통과하지 못한다(검사가 가름).
async function settledPitch(page, x, y) {
  await page.mouse.move(x, y, { steps: 12 });
  await page.waitForTimeout(300); // 고개가 돌아가는 동안은 읽지 않는다
  const samples = [];
  for (let i = 0; i < 7; i++) {
    await page.waitForTimeout(150);
    await page.mouse.move(x + (i % 2), y);
    samples.push((await turn(page))[1]);
  }
  await expect(canvas(page), "읽는 동안 잠들지 않음").toHaveAttribute("data-bot-rest", "awake");
  return samples.sort((a, b) => a - b)[3];
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
    // 예전에는 한 번 옮기고 "0.1 초과"를 기다렸다. 멈춘 값이 라이브러리 흔들림으로 0.1~0.3을
    // 오가서 0.1에 머물면 5초 뒤 잠들어(CI 41631953966의 -0.3) 실패했다. 이제 깨어 있게 두고 중앙값을 본다.
    const up = await settledPitch(page, x, area.y + 4);
    const down = await settledPitch(page, x, area.y + area.height - 4);
    expect(up, "위를 봄(반올림 0.1 단위)").toBeGreaterThanOrEqual(0.1);
    // 0.1 단위 값의 차라 부동소수(0.3 - 0.1 = 0.19999…)를 피해 열 배로 반올림해 비교한다.
    expect(Math.round((up - down) * 10), `위(${up})·아래(${down}) 차이`).toBeGreaterThanOrEqual(2);
  });

  // v0.3.6.1: 히어로 밖에서는 라이브러리의 혼자 둘러보기가 고개를 잡아, 마우스가
  // 화면 오른쪽 아래에 있어도 왼쪽을 보곤 했다. 이제 창 어디서나(머리글 포함) 따라 보고,
  // 마우스가 창을 떠날 때만 정면을 본다.
  for (const width of [1280, 1904]) {
    test(`${width}: 화면 모서리·머리글의 포인터 쪽을 보고, 창을 떠나면 정면`, async ({ page }) => {
      await desktop(page);
      await page.setViewportSize({ width, height: 960 });
      await page.mouse.move(width - 3, 957, { steps: 12 });
      await expect.poll(async () => (await turn(page))[0], { message: "오른쪽 아래 → 오른쪽" }).toBeGreaterThan(FOLLOW);
      // 아래로 숙이는 폭은 라이브러리가 작게 둔다(-0.1 안팎): 위·아래는 서로 견줘 본다.
      await expect.poll(async () => (await turn(page))[1], { message: "오른쪽 아래 → 위를 보지 않음" }).toBeLessThanOrEqual(0);
      // 고개가 다 숙여진 뒤의 값: 200ms 간격 두 번이 같을 때 읽는다(움직이는 중에 읽으면 기준이 흔들림).
      let low;
      await expect.poll(async () => {
        const a = (await turn(page))[1];
        await page.waitForTimeout(200);
        const b = (await turn(page))[1];
        low = b;
        return a === b;
      }, { message: "오른쪽 아래 고개가 멈춤" }).toBe(true);
      await page.mouse.move(3, 957, { steps: 12 });
      await expect.poll(async () => (await turn(page))[0], { message: "왼쪽 아래 → 왼쪽" }).toBeLessThan(-FOLLOW);
      await page.mouse.move(width - 3, 3, { steps: 12 });
      await expect.poll(async () => (await turn(page))[0], { message: "오른쪽 위 → 오른쪽" }).toBeGreaterThan(FOLLOW);
      // data-bot-turn은 0.1 단위로 반올림한다. 그래서 "+0.15 초과"는 "+0.2 이상"과 같고,
      // 고개를 든 것(0.2)과 들지 않은 것(0)을 그대로 가른다. 1904 모서리는 차가 약 0.2라
      // "+0.2 초과"는 반올림에 따라 같은 빌드에서 통과·실패가 갈렸다.
      await expect.poll(async () => (await turn(page))[1], { message: "오른쪽 위 → 오른쪽 아래보다 위" }).toBeGreaterThan(low + 0.15);
      const header = await page.locator("header").first().boundingBox();
      await page.mouse.move(width / 2, header.y + header.height / 2, { steps: 12 });
      await expect.poll(async () => (await turn(page))[1], { message: "머리글 → 위" }).toBeGreaterThan(0.1);
      // 마우스가 창 밖으로: relatedTarget 없는 pointerout.
      await page.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })));
      await expect.poll(async () => (await turn(page)).map((v) => Math.abs(v)).every((v) => v <= 0.1), { message: "창을 떠나면 정면" }).toBe(true);
    });
  }

  // CI 42448436301(desktop-1440): 검색칸 → 제목을 누른 뒤 오른쪽 끝으로 옮기자 고개가 +0.2(바라봄 +5.0)에서
  // 5초 머물다 잠들었고 "+0.2 초과"(= 0.3)를 기다리던 검사가 실패했다. 끝자리 고개는 라이브러리의 느린
  // 흔들림으로 0.2와 0.3을 오간다(앞선 같은 이동에서는 0.3). 여기서는 포인터를 고개가 꼭 0.2인 자리에 두어
  // 그 경우를 매번 만든다: 오른쪽을 보고 있으니 따라 보는 것으로 세어야 한다.
  test("고개 +0.2(0.1 단위)도 따라 보는 것으로 센다", async ({ page }) => {
    await desktop(page);
    const area = await hero(page).boundingBox();
    const box = await bot(page).boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(area.x + 4, y, { steps: 12 });
    await expect.poll(async () => (await turn(page))[0]).toBeLessThan(0);
    let yaw = null;
    for (let x = box.x + box.width / 2; x < area.x + area.width && yaw !== 0.2; x += 16) {
      await page.mouse.move(x, y, { steps: 2 });
      // The head eases toward the pointer: read once it has settled there.
      await page.waitForTimeout(300);
      yaw = (await turn(page))[0];
    }
    expect(yaw, "고개가 +0.2인 자리가 있음").toBe(0.2);
    expect(yaw, "오른쪽을 보고 있음 = 따라 봄").toBeGreaterThan(FOLLOW);
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
    // 검색칸을 누르면 검색칸을 내려다보고(사용자 11-03), 초점을 잃으면 다시 따라 본다.
    await page.getByRole("textbox", { name: "캐릭터 이름", exact: true }).click();
    await expect.poll(async () => Number((await canvas(page).getAttribute("data-bot-look")).split(",")[1]), { message: "검색칸을 내려다봄(눈)" }).toBeGreaterThanOrEqual(0.2);
    await page.locator("#hero-heading").click();
    await followsHorizontally(page);
    await page.locator("#hero-heading").click();
    await page.mouse.down();
    await followsHorizontally(page);
    await page.mouse.up();
    await followsHorizontally(page);
  });

  // 잠들기는 한 번에 바뀌지 않고 짧은 순서(졸린 눈꺼풀·느린 깜빡임 둘 → 고개가 끄덕이며 자리 잡음 →
  // 눈 감음)로 약 1.6초(사용자 11-03). 마지막 움직임 5초 뒤 시작해 2.2초 안에 끝나고, 그 뒤로는 그리지 않는다.
  // 길이는 벽시계가 아니라 잠들기 프레임으로 잰다: 봇은 한 프레임을 최대 0.1초로 셈하므로 느린 CI에서는
  // 벽시계로 더 걸린다. 그래서 프레임 간격을 0.1초에서 잘라 더한 값(봇이 센 시간)을 본다.
  test("잠들기는 마지막 움직임 5초 뒤 2.2초 안에 끝나고 멈춘다", async ({ page }) => {
    await desktop(page);
    await page.evaluate(() => window.addEventListener("pointermove", () => { window.__movedAt = performance.now(); }));
    await followsHorizontally(page);
    await canvas(page).evaluate((el) => {
      window.__parkedAt = 0;
      window.__draws = [];
      const ctx = el.getContext("2d");
      const clear = ctx.clearRect;
      ctx.clearRect = function (...args) { window.__draws.push(performance.now()); return clear.apply(this, args); };
      new MutationObserver(() => {
        if (el.dataset.botLoop === "parked" && el.dataset.botRest === "asleep" && !window.__parkedAt) window.__parkedAt = performance.now();
      }).observe(el, { attributes: true, attributeFilter: ["data-bot-loop", "data-bot-rest"] });
    });
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "asleep", { timeout: 9000 });
    const { took, doze, frames } = await page.evaluate(() => {
      const start = window.__movedAt + 5000;
      const ts = window.__draws.filter((t) => t >= start && t <= window.__parkedAt);
      let doze = 0;
      for (let i = 1; i < ts.length; i++) doze += Math.min(100, ts[i] - ts[i - 1]);
      return { took: window.__parkedAt - window.__movedAt, doze, frames: ts.length };
    });
    expect(took, "5초 쉰 뒤 잠들기 시작").toBeGreaterThan(5000 + 1000);
    // 잠드는 동안 매 단계를 그린다(한 번에 바뀌지 않음).
    expect(frames, "잠들기 프레임 수").toBeGreaterThanOrEqual(10);
    expect(doze, "잠들기 길이(봇이 센 시간)").toBeGreaterThan(1000);
    expect(doze, "잠들기 2.2초 안(봇이 센 시간)").toBeLessThan(2200);
  });

  test("움직임이 멎고 5초 뒤 잠든 그림으로 그리기를 멈추고, 다음 움직임에 깨어난다", async ({ page }) => {
    await desktop(page);
    await followsHorizontally(page);
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "running");
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "awake");
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked", { timeout: 9000 });
    // 잠든 자세: 눈을 감고 고개를 숙인다(라이브러리의 sleeping, 약 -16°).
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "asleep");
    expect((await turn(page))[1]).toBeLessThan(-0.2);
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
    const box = await bot(page).boundingBox();
    const before = await hops(page);
    await page.mouse.move(area.x + 4, box.y + box.height / 2);
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "running");
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "awake");
    // 깨어날 때 한 번 뛴다(사용자 11-02). 깬 뒤의 움직임에는 더 뛰지 않는다.
    await expect.poll(() => hops(page), { message: "깨어날 때 한 번" }).toBe(before + 1);
    // 깨어나 고개를 들고 다시 포인터(왼쪽)를 본다.
    await expect.poll(async () => (await turn(page))[1], { message: "고개를 든다" }).toBeGreaterThan(-0.15);
    await expect.poll(async () => (await turn(page))[0], { message: "왼쪽을 본다" }).toBeLessThan(-FOLLOW);
    await page.mouse.move(area.x + area.width - 4, box.y + box.height / 2, { steps: 12 });
    // 다시 쉬면 잠들고 멈춘다. 그동안 더 뛰지 않았다.
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "asleep", { timeout: 9000 });
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked");
    expect(await hops(page), "깨어난 뒤 더 뛰지 않음").toBe(before + 1);
  });

  // 검색칸을 누를 때(초점) 한 번 뛴다(사용자 11-03). 검색을 보내면 화면이 떠나서 그때는 뛰지 않는다.
  test("검색칸에 초점이 올 때마다 한 번 뛰고, 글자 입력·검색 보내기에는 뛰지 않는다", async ({ page }) => {
    await desktop(page);
    // 캐릭터 화면으로 가는 요청을 붙잡아 히어로에 머문다.
    await page.route(/\/character\//, () => {});
    const box = page.getByRole("textbox", { name: "캐릭터 이름", exact: true });
    const before = await hops(page);
    await box.click();
    await expect.poll(() => hops(page), { message: "초점에 한 번" }).toBe(before + 1);
    await page.keyboard.type("테스트", { delay: 40 });
    await page.waitForTimeout(600);
    expect(await hops(page), "글자 입력에 뛰지 않음").toBe(before + 1);
    // 초점을 잃었다가 다시 오면(키보드 Tab도) 또 한 번.
    await page.locator("#hero-heading").click();
    await page.waitForTimeout(500);
    expect(await hops(page), "초점을 잃을 때 뛰지 않음").toBe(before + 1);
    await box.click();
    await expect.poll(() => hops(page), { message: "다시 초점에 한 번" }).toBe(before + 2);
    // 한 동작 안(400ms)의 두 번째 뛰기는 건너뛴다. 다른 동작이 되도록 잠시 둔다.
    await page.waitForTimeout(500);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(box).toBeFocused();
    await expect.poll(() => hops(page), { message: "Tab으로 돌아온 초점에 한 번" }).toBe(before + 3);
    // 검색 보내기: 찾는 중이 되어도 더 뛰지 않는다.
    await hero(page).getByRole("button", { name: "캐릭터 검색" }).click();
    await expect(page.getByText("캐릭터 화면으로 이동하고 있어요")).toBeVisible();
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "running");
    await page.waitForTimeout(1500);
    expect(await hops(page), "검색 보내기에 뛰지 않음").toBe(before + 3);
  });

  test("잠든 봇은 검색칸을 눌러 깨워도 한 번만 뛴다", async ({ page }) => {
    await desktop(page);
    await followsHorizontally(page);
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "asleep", { timeout: 9000 });
    const before = await hops(page);
    // 누르기 한 번이 깨우기(포인터)와 초점을 함께 부른다: 한 번만 뛴다.
    await page.getByRole("textbox", { name: "캐릭터 이름", exact: true }).click();
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "awake");
    await expect.poll(() => hops(page), { message: "깨우며 초점에 한 번" }).toBe(before + 1);
    await page.waitForTimeout(800);
    expect(await hops(page), "두 번 뛰지 않음").toBe(before + 1);
  });

  test("멈춘 채 검색칸에 초점이 오거나 검색을 보내도 뛰지 않는다", async ({ page }) => {
    await desktop(page);
    await page.route(/\/character\//, () => {});
    // 키보드로 멈춘다(마우스로 누르면 봇 위로 옮기는 움직임이 먼저 깨울 수 있다).
    await pause(page).focus();
    await page.keyboard.press("Enter");
    await expect(pause(page)).toHaveAttribute("aria-pressed", "true");
    const before = await hops(page);
    const box = page.getByRole("textbox", { name: "캐릭터 이름", exact: true });
    await box.click();
    await page.keyboard.type("테스트");
    await page.locator("#hero-heading").click();
    await box.focus();
    await hero(page).getByRole("button", { name: "캐릭터 검색" }).click();
    await expect(page.getByText("캐릭터 화면으로 이동하고 있어요")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await hops(page), "멈춘 채 뛰지 않음").toBe(before);
  });

  test("멈춤 상태에서는 잠들지 않고 깬 채로 쉰다", async ({ page }) => {
    await desktop(page);
    await bot(page).click();
    await expect(pause(page)).toHaveAttribute("aria-pressed", "true");
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked", { timeout: 9000 });
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "awake");
    // 다시 재생하면 5초 뒤 잠든다.
    await bot(page).click();
    await expect(pause(page)).toHaveAttribute("aria-pressed", "false");
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "asleep", { timeout: 9000 });
    await expect(canvas(page)).toHaveAttribute("data-bot-loop", "parked");
    // 봇을 눌러 멈춤·재생한 것으로는 뛰지 않는다(누른 것은 멈춤 버튼).
    expect(await hops(page)).toBe(0);
    // 잠든 봇을 멈춰도 뛰지 않고, 멈춘 채 몸을 바꿔도 뛰지 않는다. 키보드로 멈춘다:
    // 마우스로 누르면 봇 위로 옮기는 움직임이 먼저 봇을 깨워 한 번 뛰는 것이 맞는 동작이다.
    await pause(page).focus();
    await page.keyboard.press("Enter");
    await expect(pause(page)).toHaveAttribute("aria-pressed", "true");
    expect(await hops(page), "멈출 때 뛰지 않음").toBe(0);
    await page.getByRole("button", { name: "봇 바꾸기" }).click();
    await page.keyboard.press("ArrowRight");
    await expect(bot(page)).toHaveAttribute("data-bot", "flower");
    await page.waitForTimeout(800);
    expect(await hops(page), "멈춘 동안 뛰지 않음").toBe(0);
  });

  test("봇 그림 코드는 첫 로드에 없다: 페이지 로드 뒤 쉴 때 받아 그린다", async ({ page }) => {
    // 그림 코드에만 있는 글(클로버 몸의 경로 시작)로 그 조각의 주소를 알아내고, 요청 시각은
    // 페이지 자신의 시계(그 조각의 startTime과 load 이벤트 시작)로 비교한다. (모자 이름은
    // 11-03부터 '봇 바꾸기'의 선택지로 첫 로드에도 있어 표지로 쓰지 않는다.)
    const botUrls = new Set();
    page.on("response", async (response) => {
      if (response.request().resourceType() !== "script") return;
      const body = await response.text().catch(() => "");
      if (body.includes("M26.53 22.38A25 25")) botUrls.add(response.url());
    });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/", { waitUntil: "load" });
    await expect(canvas(page)).toHaveAttribute("data-bot-turn", /,/, { timeout: 8000 });
    await expect.poll(() => botUrls.size, { message: "그림 코드 조각은 한 번" }).toBe(1);
    const order = await page.evaluate((url) => {
      const [entry] = performance.getEntriesByName(url);
      const [nav] = performance.getEntriesByType("navigation");
      return { start: entry?.startTime ?? -1, load: nav.loadEventStart };
    }, [...botUrls][0]);
    expect(order.load, "load 이벤트가 있었다").toBeGreaterThan(0);
    expect(order.start, `load(${order.load}ms) 뒤에 받는다`).toBeGreaterThanOrEqual(order.load);
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
    // 줄어든 모션은 기본 자세(눈 뜸) 그대로, 잠들지 않고 뛰지도 않는다.
    await expect(canvas(page)).toHaveAttribute("data-bot-rest", "awake");
    expect(before).toEqual([0, 0]);
    await page.getByRole("button", { name: "봇 바꾸기" }).click();
    await page.keyboard.press("ArrowRight");
    await expect(bot(page)).toHaveAttribute("data-bot", "flower");
    await page.waitForTimeout(600);
    expect(await hops(page), "줄어든 모션은 뛰지 않음").toBe(0);
  });

  test("봇 바꾸기: 봇을 누르면 고르고 바로 닫히며 초점은 버튼으로", async ({ page }) => {
    await desktop(page);
    const trigger = page.getByRole("button", { name: "봇 바꾸기" });
    await trigger.click();
    const group = page.getByRole("radiogroup", { name: "봇 모양" });
    await expect(group.getByRole("radio")).toHaveCount(18);
    await group.getByRole("radio", { name: "꽃" }).click();
    // 바깥을 누르지 않아도 고르는 즉시 닫힌다(사용자 11-03).
    await expect(group).toBeHidden();
    await expect(bot(page)).toHaveAttribute("data-bot", "flower");
    await expect(trigger).toBeFocused();
    // 키보드: 화살표는 고르기만 하고 열린 채, Enter로 고르고 닫는다.
    await trigger.press("Enter");
    await expect(group.getByRole("radio", { name: "꽃" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(group).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(group).toBeHidden();
    await expect(bot(page)).not.toHaveAttribute("data-bot", "flower");
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
    // 새 몸은 한 바퀴 돌며 한 번 뛰어 나온다(사용자 11-02).
    expect(await hops(page), "바꿀 때 한 번").toBe(1);
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
