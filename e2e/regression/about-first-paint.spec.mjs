// 회귀(사용자 11-09): 소개(/about)에 커서가 페이지를 짓는 소개는 없다. 주소로 열어도, 머리글 메뉴로 와도,
// 뒤로·앞으로 와도 첫 화면은 처음 그림부터 다 보이고 흔들림이 없다. 처음 HTML에 모든 구역이 들어 있고,
// 아래 구역은 원래의 스크롤 나타나기 그대로.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince, shiftMark } from "../support/shifts.mjs";

const SECTIONS = ["intro", "preview", "evidence", "roadmap"];

/** The hero's text (LOAKraken, the title, the two paragraphs): each one's opacity. */
const heroText = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('section[aria-labelledby="hero-heading"] [class*="heroEnter"]')].map((el) => getComputedStyle(el).opacity),
  );

/** hero-enter animations on the hero title (a finished one still counts: it holds its end state). */
const entrances = (page) =>
  page.locator("#hero-heading").evaluate((el) => el.getAnimations().filter((a) => /hero-enter/.test(a.animationName)).length);

/** Nothing of a self-building intro is left on the page. */
async function noIntro(page) {
  expect(await page.evaluate(() => document.documentElement.className), "html에 소개 표시 없음").not.toMatch(/intro/);
  await expect(page.locator("[data-build-block], [data-intro-cursor], [data-intro-layer]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "소개 건너뛰기" })).toHaveCount(0);
}

for (const width of [320, 390, 1280])
  test(`소개 ${width}: 첫 화면이 처음부터 다 보이고 흔들림 0, 모든 구역이 처음 HTML에 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const html = await (await page.request.get("/about")).text();
    for (const id of SECTIONS) expect(html, `처음 HTML의 #${id}`).toContain(`id="${id}"`);
    expect(html, "처음 HTML에 소개 스크립트 없음").not.toContain("about-intro");
    await watchShifts(page);
    await page.goto("/about");
    // The first paint: the title is already shown (the largest text, the LCP).
    expect(await page.locator("#hero-heading").evaluate((el) => getComputedStyle(el).opacity), "로드 때 제목이 이미 보임").toBe("1");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-motion="on"]')).toHaveCount(1);
    await noIntro(page);
    expect((await heroText(page)).every((o) => o === "1"), "히어로 글 모두 보임(등장 애니메이션 없음)").toBe(true);
    // A fixed wait proves an absence: nothing moves once the page has woken.
    await page.waitForTimeout(800);
    const shift = await shiftsSince(page);
    expect(shift.all, `흔들림 (${shift.moved})`).toBe(0);
  });

test("소개 1280: 머리글 메뉴로 와도, 뒤로·앞으로 와도 처음부터 완성된 페이지 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await watchShifts(page);
  await gotoReady(page, "/");
  await page.waitForFunction(() => window.__lkHydrated);
  await page.evaluate(() => (window.__sameDocument = true));
  await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "소개", exact: true }).click();
  await expect(page).toHaveURL(/\/about#intro$/);
  await expect(page.locator('[data-motion="on"]')).toHaveCount(1);
  // From the moment /about is in: what moves there (the page swap itself is not a shift).
  const mark = await shiftMark(page);
  expect(await page.evaluate(() => window.__sameDocument), "같은 문서 안의 이동").toBe(true);
  await noIntro(page);
  // Put in the page by the client, the hero text plays its one short entrance (#1463), then stays.
  await expect.poll(async () => (await heroText(page)).every((o) => o === "1"), { message: "히어로 글 모두 보임" }).toBe(true);
  await page.waitForTimeout(800); // proves an absence: nothing moves after arriving
  const shift = await shiftsSince(page, mark);
  expect(shift.all, `흔들림 (${shift.moved})`).toBe(0);

  // Through the menu (a forward navigation) the title plays its one short entrance (#1463).
  expect(await entrances(page), "메뉴로 오면 등장 한 번").toBe(1);

  // Back to the home page and forward again: pages already seen come back as they were,
  // with no entrance (PM 11-09).
  await page.goBack();
  await expect(page).not.toHaveURL(/\/about/);
  await expect(page.locator("#hero-heading")).toBeVisible();
  expect(await entrances(page), "뒤로: 홈 히어로 등장 없음").toBe(0);
  await page.goForward();
  await expect(page).toHaveURL(/\/about#intro$/);
  // Back on /about: every section is there at once (nothing waits to be built).
  await expect(page.locator('[data-motion="on"]')).toHaveCount(1);
  const back = await shiftMark(page);
  expect(await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), SECTIONS), "뒤로·앞으로: 모든 구역이 바로 있음").toEqual([]);
  await noIntro(page);
  expect(await entrances(page), "앞으로: 소개 히어로 등장 없음").toBe(0);
  expect((await heroText(page)).every((o) => o === "1"), "뒤로·앞으로: 히어로 글이 처음부터 다 보임").toBe(true);
  await page.waitForTimeout(800); // proves an absence: nothing moves after coming back
  const backShift = await shiftsSince(page, back);
  expect(backShift.all, `뒤로·앞으로 흔들림 (${backShift.moved})`).toBe(0);
});
