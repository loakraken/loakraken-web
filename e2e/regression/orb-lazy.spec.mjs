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
