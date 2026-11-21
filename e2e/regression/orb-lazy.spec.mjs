// 회귀(#1867, PM 총괄 11-21 성능 점검): 생각하는 구슬(thinking-orbs)은 첫 그림 뒤에 받는다. 받기 전에는 같은 자리에 구슬의
// 정지 화면(SVG)이 서 있고, 받으면 캔버스가 같은 상자에서 이어 그린다 — 자리 그대로.
// 라이브러리 묶음을 붙잡아(그 묶음이 남기는 표지 글 'Listening…') 받기 전을 정해진 상태로 만들고, 사이트 안에서 검색해
// 들어가는 '조회 중' 화면의 64px 구슬로 본다. 서버 HTML의 정지 화면 · 어두운 색은 character-loading-orb가 본다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const MARKER = "Listening…";

/** Holds every JS chunk that carries thinking-orbs until the returned release() is called. */
async function holdOrbLibrary(page) {
  let release;
  const gate = new Promise((r) => (release = r));
  const held = [];
  await page.route(/\/_next\/static\/chunks\/.+\.js$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes(MARKER)) {
      held.push(route.request().url());
      await gate;
    }
    await route.fulfill({ response, body });
  });
  return { release, held };
}

const boxOf = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });

for (const width of [320, 1280])
  test(`${width}: 구슬 라이브러리가 오기 전엔 정지 화면, 오면 같은 64px 상자에서 캔버스 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const orb = await holdOrbLibrary(page);
    await gotoReady(page, "/");
    const search = page.getByRole("textbox", { name: "캐릭터 이름" });
    await search.fill("로딩긴");
    await search.press("Enter");
    const main = page.locator("main[aria-busy]");
    await expect(main.getByRole("status")).toHaveText("캐릭터 정보를 조회하고 있어요.");
    // Before the library: the still frame, the canvas's box (64×64), painted dots.
    const still = main.locator("svg");
    await expect(still).toBeVisible();
    expect(orb.held.length, "구슬 라이브러리 묶음을 붙잡음").toBeGreaterThan(0);
    await expect(main.locator("canvas")).toHaveCount(0);
    const before = await boxOf(still);
    expect(before).toMatchObject({ w: 64, h: 64 });
    expect(await still.locator("path").count()).toBeGreaterThan(10);
    // The library comes: the canvas in the same box, the still gone.
    orb.release();
    const canvas = main.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect(still).toHaveCount(0);
    expect(await boxOf(canvas)).toEqual(before);
  });

// codex P3s on #1871: a failed library load or a canvas that cannot draw leaves the still in the box (never an empty
// one), and a failed load is no unhandled rejection. The network error of the refused chunk is the console line
// this allows; page errors (uncaught throws, unhandled rejections) are collected and must stay empty.
test.describe("구슬이 그려지지 못할 때", () => {
  test.use({ allowConsoleErrors: true });

  const toLoadingScreen = async (page) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await gotoReady(page, "/");
    const search = page.getByRole("textbox", { name: "캐릭터 이름" });
    await search.fill("로딩긴");
    await search.press("Enter");
    const main = page.locator("main[aria-busy]");
    await expect(main.getByRole("status")).toHaveText("캐릭터 정보를 조회하고 있어요.");
    return main;
  };

  test("320: 라이브러리 묶음을 못 받으면 정지 화면이 남고, 처리 안 된 거부가 없다 @regression", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.route(/\/_next\/static\/chunks\/.+\.js$/, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes(MARKER)) return route.abort("failed");
      await route.fulfill({ response, body });
    });
    const main = await toLoadingScreen(page);
    await page.waitForTimeout(2500);
    await expect(main.locator("svg")).toBeVisible();
    expect(await boxOf(main.locator("svg"))).toMatchObject({ w: 64, h: 64 });
    await expect(main.locator("canvas")).toHaveCount(0);
    expect(pageErrors, "처리 안 된 오류 · 거부").toEqual([]);
  });

  test("320: 캔버스가 그릴 수 없으면(2D 문맥 없음) 정지 화면이 그 상자에 남는다 @regression", async ({ page }) => {
    await page.addInitScript(() => {
      const native = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        return kind === "2d" ? null : native.call(this, kind, ...rest);
      };
    });
    const main = await toLoadingScreen(page);
    await page.waitForTimeout(3000);
    const still = main.locator("svg").first();
    await expect(still).toBeVisible();
    expect(await boxOf(still)).toMatchObject({ w: 64, h: 64 });
    expect(await still.locator("path").count()).toBeGreaterThan(10);
  });

  // codex P3 on #1873: after its first frame the library draws in its own requestAnimationFrame loop, outside
  // React's error boundary. A frame clears the canvas first, so a throw while drawing left an empty box.
  const breakDrawingOnDemand = (page) =>
    page.addInitScript(() => {
      const native = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc = function (...args) {
        if (window.__orbBreak) throw new Error("orb draw failed (test)");
        return native.apply(this, args);
      };
    });
  const toPaintedCanvas = async (page) => {
    const main = await toLoadingScreen(page);
    await expect(main.locator("canvas")).toBeVisible();
    // The still leaves only once the canvas has inked a frame.
    await expect(main.locator("svg")).toHaveCount(0);
    return main;
  };

  test("320: 그리던 중 오류가 나면 비워진 캔버스 자리에 정지 화면이 돌아온다 @regression", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await breakDrawingOnDemand(page);
    const main = await toPaintedCanvas(page);
    const box = await boxOf(main.locator("canvas"));
    await page.evaluate(() => (window.__orbBreak = true));
    const still = main.locator("svg");
    await expect(still).toBeVisible();
    await expect(main.locator("canvas")).toHaveCount(0);
    expect(await boxOf(still)).toEqual(box);
    expect(await still.locator("path").count()).toBeGreaterThan(10);
    // The throw came from the library's frame loop (an uncaught page error), not from a React render.
    expect(pageErrors).toContain("orb draw failed (test)");
  });

  test("320: 구슬과 상관없는 오류에는 그리던 캔버스가 그대로다 @regression", async ({ page }) => {
    const main = await toPaintedCanvas(page);
    const thrown = page.waitForEvent("pageerror", (error) => error.message === "unrelated (test)");
    await page.evaluate(() => setTimeout(() => {
      throw new Error("unrelated (test)");
    }));
    await thrown;
    // Give a swap (if any) a few frames to render.
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));
    await expect(main.locator("canvas")).toBeVisible();
    await expect(main.locator("svg")).toHaveCount(0);
  });
});
