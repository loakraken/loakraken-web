// 회귀(A7 첫 로드 흔들림, 남은 화면 훑기: 공지·레이드 보상표·시세 알림): 첫 HTML은 어디서든 끊겨 올 수 있다. 11-15 훑기에서
// 움직인 것: 공지의 '공식 공지' 링크(오른쪽 끝이라 글자가 오면 왼쪽으로), 공지 종류 알약과 분류 칩(늦게 온 칩이 줄을 바꿈),
// 이벤트 개수(숫자와 글자가 나뉜 글자 노드), 레이드 보상표의 규칙 줄(나뉜 숫자)·분류 칩·'공식' 표시, 시세 알림 추가 줄(자동 폭
// 칸이 다시 재짐, 1280). 묶음은 끝 표시가 온 뒤에 그리고, 나뉜 글자는 한 노드로. 움직인 너비에서 그 묶음 안만 자른다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const CASES = [
  ["/news", 320, "main|", (page) => page.getByRole("group", { name: "공지 분류" }).getByRole("button").first()],
  ["/news", 1280, "main|", (page) => page.getByRole("link", { name: /공식 공지/ })],
  ["/tools/raid-rewards", 320, "main|", (page) => page.getByRole("group", { name: "레이드 분류" }).getByRole("button").last()],
  ["/tools/raid-rewards", 1280, "main|", (page) => page.getByText("공식", { exact: true }).first()],
  ["/market/alerts", 1280, 'section[aria-labelledby="alerts-add"]|', (page) => page.getByRole("button", { name: "알림 추가" })],
];

for (const [path, width, root, gated] of CASES)
  test(`@A7 ${width} ${path}: 첫 HTML이 어디서 끊겨도 움직이지 않는다 @regression`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, path);
    await page.evaluate(() => document.fonts.ready);
    // The gated part is drawn once its end mark is in (a lost mark would keep it hidden and pass the cut).
    await expect(gated(page)).toBeVisible();
    const cut = await cutEverywhere(page, root);
    expect(cut.probed, cut.moved.join(" / ")).toBeGreaterThan(10);
    expect(cut.value, `늦게 온 부분이 민 것:\n${cut.moved.slice(0, 8).join("\n")}`).toBe(0);
  });
