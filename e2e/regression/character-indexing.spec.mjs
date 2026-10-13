// 회귀(API 목록 #12, PM 총괄 10-13): 캐릭터 페이지 색인(CHARACTER_INDEXING, e2e에서는 켬).
// 색인할 수 있는 캐릭터만 index, 나머지는 noindex. 검색봇은 캐시 페이지만(공식 호출 0).
// B5: 처리정지(저장 기록·실시간 캐시)·미기록·원정대 목록에서만 발견은 봇 화면이 이름 말고는 똑같다.
import { test, expect } from "../support/fixtures.mjs";

const MOCK = `http://127.0.0.1:${process.env.E2E_MOCK_PORT ?? 3201}`;
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const robots = (page) => page.locator('meta[name="robots"]').getAttribute("content");
const searches = async (request, name) => ((await (await request.get(`${MOCK}/__counts`)).json())[name] ?? 0);

test.describe("검색봇", () => {
  test.use({ userAgent: GOOGLEBOT });

  test("색인할 수 있는 캐릭터: index·요약 줄, 공식 조회 없음 @regression", async ({ page, request }) => {
    await page.goto("/character/%EA%B3%B5%EA%B0%9C%EC%9A%94%EC%95%BD");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("공개요약");
    await expect(page.getByText("아만 · 블레이드 · 아이템 레벨 1,770 · 전투력 4,000 · 버스트")).toBeVisible();
    expect(await robots(page)).toBe("index, follow");
    expect(await searches(request, "공개요약")).toBe(0);
  });

  test("B5: 처리정지·미기록·발견만은 이름 말고 같은 화면, 모두 noindex @regression", async ({ page, request }) => {
    const bodies = [];
    for (const name of ["미기록요약", "정지저장", "발견만", "정지캐시"]) {
      await page.goto(`/character/${encodeURIComponent(name)}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
      expect(await robots(page), name).toBe("noindex, nofollow");
      bodies.push((await page.locator("main").innerHTML()).replaceAll(name, "<이름>"));
      expect(await searches(request, name), name).toBe(0);
    }
    expect(new Set(bodies).size).toBe(1);
  });
});

test("사람은 그대로 실시간 화면, 메타만 색인 판단 @regression", async ({ page }) => {
  await page.goto("/character/%EA%B3%B5%EA%B0%9C%EC%9A%94%EC%95%BD");
  await expect(page.getByRole("region", { name: "공개요약 캐릭터 요약" })).toBeVisible();
  expect(await robots(page)).toBe("index, follow");
  await page.goto("/character/%EB%B0%9C%EA%B2%AC%EB%A7%8C");
  expect(await robots(page)).toBe("noindex, nofollow");
});

test("사이트맵에 캐릭터 페이지는 없다 @regression", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("<urlset");
  expect(xml).not.toContain("/character/");
});
