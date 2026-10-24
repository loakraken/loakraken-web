// 회귀(#1043): 전투 탭의 '원정대 카드 기록'은 첫 HTML에 담겨 처음부터 그려진다. 늦게 붙으면 한 열 화면에서
// 그 아래 요약 열(순위·특성…)이 약 360px 밀렸다(화면 아래라 흔들림 점수에는 안 잡힘). 첫 그림 직후와 6초 뒤
// '특성' 제목의 위치가 같다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

const traitTop = (page) =>
  page.evaluate(() => {
    const h = [...document.querySelectorAll("main h2, main h3")].find((e) => /^특성/.test(e.textContent.trim()));
    return h ? Math.round(h.getBoundingClientRect().top + scrollY) : null;
  });

for (const width of [320, 360, 390, 1280])
  test(`@카드기록 ${width}: 첫 HTML에 있고 특성 위치가 그대로 @regression`, async ({ page, request }) => {
    // In the server's HTML, before any script runs.
    const html = await (await request.get(characterPath("상세"))).text();
    expect(html, "첫 HTML의 원정대 카드 기록").toContain("원정대 카드 기록");
    expect(html, "첫 HTML이 불러오는 중이 아님").not.toContain("카드 기록을 불러오고 있어요");

    await page.setViewportSize({ width, height: 900 });
    await page.goto(characterPath("상세"), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const early = await traitTop(page);
    expect(early, "특성 제목").not.toBeNull();
    await page.waitForTimeout(6000);
    expect(await traitTop(page), "특성 제목 위치").toBe(early);
  });
