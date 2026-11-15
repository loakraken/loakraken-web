// 회귀(A7 첫 로드 흔들림, 남은 화면 훑기: 시세·여러 캐릭터 비교): 첫 HTML은 어디서든 끊겨 올 수 있다. 11-15 훑기에서 움직인 것:
// 시세 상세 머리의 이름·등급 두 줄(아이콘 옆 가운데 맞춤이라 둘째 줄이 오면 이름이 올라감), 하루 평균 표(줄이 올 때마다 칸
// 폭이 다시 정해짐), 보드 제목(개수가 늦게 와 줄 기준선이 바뀜), 여러 캐릭터 비교의 '비교하기'(줄 끝)와 빈 화면 안내(가운데
// 맞춘 두 줄). 묶음은 끝 표시가 온 뒤에 그린다. 움직인 너비에서 본문(main) 안을 자른다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const CASES = [
  ["/market", 1280, (page) => page.getByRole("columnheader", { name: "평균 거래가", exact: true }).first()],
  ["/market", 320, (page) => page.locator("#board-heading")],
  ["/multi-search", 1280, (page) => page.getByRole("button", { name: "비교하기" })],
];

for (const [path, width, gated] of CASES)
  test(`@A7 ${width} ${path}: 첫 HTML이 어디서 끊겨도 움직이지 않는다 @regression`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, path);
    await page.evaluate(() => document.fonts.ready);
    // The gated part is drawn once its end mark is in (a lost mark would keep it hidden and pass the cut).
    await expect(gated(page)).toBeVisible();
    const cut = await cutEverywhere(page, "main|");
    expect(cut.probed, cut.moved.join(" / ")).toBeGreaterThan(20);
    expect(cut.value, `늦게 온 부분이 민 것:\n${cut.moved.slice(0, 8).join("\n")}`).toBe(0);
  });
