// 회귀(A7 첫 로드 흔들림, 남은 화면 훑기 마지막 묶음): 첫 HTML은 어디서든 끊겨 올 수 있다. 11-15 다시 훑기에서 남은 것:
// 본문 줄이 큰 화면의 테마 단추 칸(아이콘이 오기 전 52px → 44px, 메뉴 항목과 같은 원인 #1688), 소개의 '캐릭터 화면 미리보기'
// 링크(가운데라 글자가 오면 왼쪽으로), 일정 화면의 다가오는 일정 카드(세 줄 가운데 맞춤), 머리 도구(범례가 오면 토글이 밀림),
// 보상 칩, 골드 섬 개수(나뉜 글자). 화면 전체를 어디서 잘라도 움직이지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

// /schedule reads the clock: the mock lists today's rounds (its date is the real KST day), and the upcoming
// cards are the rounds after the browser's now. Late at night none are left (after 23:00 on odd dates, 23:50 on
// even ones), so the browser clock is pinned to 10:00 KST on the mock's own date, as hide-past does (codex #1692
// P2). The cut copies the settled page, so the server having drawn with the real time does not matter here.
const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const MORNING = () => Date.parse(`${kstToday()}T10:00:00+09:00`);

const CASES = [
  ["/about", 320, (page) => page.getByRole("link", { name: /캐릭터 화면 미리보기/ })],
  ["/about", 1280, (page) => page.getByRole("button", { name: "화면 테마" })],
  ["/contact", 320, (page) => page.getByRole("button", { name: "화면 테마" })],
  ["/schedule", 320, (page) => page.getByRole("region", { name: "다가오는 일정" }).locator("li").first()],
  ["/schedule", 1280, (page) => page.getByRole("button", { name: "지난 회차 숨김" })],
];

for (const [path, width, gated] of CASES)
  test(`@A7 ${width} ${path}: 첫 HTML이 어디서 끊겨도 화면이 움직이지 않는다 @regression`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    if (path === "/schedule") await page.clock.setFixedTime(MORNING());
    await gotoReady(page, path);
    await page.evaluate(() => document.fonts.ready);
    // The gated part is drawn once its end mark is in (a lost mark would keep it hidden and pass the cut).
    await expect(gated(page)).toBeVisible();
    const cut = await cutEverywhere(page, null);
    expect(cut.probed, cut.moved.join(" / ")).toBeGreaterThan(40);
    expect(cut.value, `늦게 온 부분이 민 것:\n${cut.moved.slice(0, 8).join("\n")}`).toBe(0);
  });
