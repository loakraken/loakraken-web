// 회귀(#1949): 전투력 시뮬레이터에 이름이 주소에 있으면 캐릭터 · 선택지 응답이 첫 HTML에 담긴다. 화면에서 받던
// 때는 모든 JS를 받고 붙인 뒤에야 요청이 나가 첫 화면의 큰 글(장비 안내 줄)이 늦게 그려졌다(LCP 3.1~3.2초,
// 320 · CPU 4× · Slow 4G). 화면은 같은 요청을 다시 보내지 않고, 검색봇에게는 서버도 백엔드를 부르지 않으며,
// 서버가 못 받은 캐릭터는 화면이 지금처럼 받아 알린다.
import { test, expect } from "../support/fixtures.mjs";

const MOCK = `http://127.0.0.1:${process.env.E2E_MOCK_PORT ?? 3201}`;
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const NAME = "전투력코어도약";
const path = (name) => `/tools/combat-power?character=${encodeURIComponent(name)}`;
const NOTE = "방어구 품질은 생명 활성력";
const searches = async (request, name) => ((await (await request.get(`${MOCK}/__counts`)).json())[name] ?? 0);

test("이름이 있으면 시뮬레이터가 첫 HTML에 있고 화면은 캐릭터 · 선택지를 다시 받지 않는다 @regression", async ({ page, request }) => {
  const html = await (await request.get(path(NAME))).text();
  expect(html, "첫 HTML의 장비 안내 줄").toContain(NOTE);
  expect(html, "첫 HTML이 불러오는 중이 아님").not.toContain("캐릭터 정보를 읽고 있어요");

  const asked = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname === "/api/characters" || url.pathname === "/api/combat-power/options") asked.push(url.pathname);
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(path(NAME));
  await expect(page.getByText(NOTE)).toBeVisible();
  // Past hydration and the effects that would fetch a missing query.
  await expect(page.getByRole("combobox", { name: "테스트 코어 포인트", exact: true })).toBeEnabled();
  await page.waitForTimeout(1500);
  expect(asked, "화면에서 다시 보낸 요청").toEqual([]);
});

test("서버가 못 받은 캐릭터는 화면이 지금처럼 받아 알린다 @regression", async ({ page }) => {
  await page.goto(path("미존재"));
  await expect(page.getByRole("alert")).toBeVisible();
});

test.describe("검색봇", () => {
  test.use({ userAgent: GOOGLEBOT });

  test("검색봇에게는 서버가 캐릭터를 부르지 않는다 @regression", async ({ request }) => {
    const before = await searches(request, NAME);
    const html = await (await request.get(path(NAME), { headers: { "user-agent": GOOGLEBOT } })).text();
    expect(html, "봇의 첫 HTML").not.toContain(NOTE);
    expect(await searches(request, NAME), "백엔드 캐릭터 조회").toBe(before);
  });
});
