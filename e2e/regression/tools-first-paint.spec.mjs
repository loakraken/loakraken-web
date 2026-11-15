// 회귀(A7 첫 로드 흔들림, 남은 화면 훑기: 성장 도구·직업 통계): 첫 HTML은 어디서든 끊겨 올 수 있다. 11-15 훑기에서 움직인 것:
// 도구 목록 카드(가운데 맞춘 두 줄 중 설명이 오면 이름이 올라감), 로아 상점 가격(오른쪽 끝, 단위가 오면 왼쪽으로), 줄 끝의
// 불러오기·계산하기·장비 불러오기·다시 정렬 버튼(글자가 오면 왼쪽으로 커짐), 지옥 보상의 클리어 단계 칸과 단계 표, 더보기 표
// (여러 줄에 걸친 레이드 이름 칸이 줄이 올 때마다 내려감)과 '값 매기기 바꾸기' 링크, 직업 통계의 조건 줄과 '표본이 모이면' 카드.
// 묶음은 끝 표시가 온 뒤에 그린다. 움직인 너비에서 본문(main) 안을 자른다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const CASES = [
  ["/tools", 360, (page) => page.getByRole("link", { name: /재련 기대 비용/ })],
  ["/tools/loa-shop", 360, (page) => page.getByText("로열 크리스탈", { exact: true }).first()],
  ["/tools/combat-power", 320, (page) => page.getByRole("button", { name: "불러오기", exact: true })],
  ["/tools/crit-speed", 1280, (page) => page.getByRole("button", { name: "계산하기", exact: true })],
  ["/tools/refining", 1280, (page) => page.getByRole("button", { name: "장비 불러오기" })],
  ["/tools/hell-reward", 1280, (page) => page.getByRole("button", { name: "지금 시세로 다시 정렬" })],
  ["/tools/more-reward", 1280, (page) => page.getByRole("columnheader", { name: "레이드", exact: true })],
  [`/stats/classes/${encodeURIComponent("바드")}`, 360, (page) => page.getByRole("group", { name: "최근 확인" }).getByRole("button").first()],
];

for (const [path, width, gated] of CASES)
  test(`@A7 ${width} ${decodeURIComponent(path)}: 첫 HTML이 어디서 끊겨도 움직이지 않는다 @regression`, async ({ page }) => {
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
