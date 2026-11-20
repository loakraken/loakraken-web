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

// A6 flake (11-19, CI 0.503 on section.settings at 112ms, /tools/crit-speed @360): the HTML has the settings
// before the output, and at ≤900px the output (a screen tall, CSS order -1) is drawn above them. A first
// paint with the settings in and the output not yet put them on screen, then the output pushed them down.
// cutEverywhere never makes that cut: its cut points are nodes on screen in the finished page, and the
// settings end up below it. So this one cut by hand: the settings section in, everything after it not yet.
for (const width of [360, 390, 768, 1280])
  test(`@A7 ${width} /tools/crit-speed: 가정이 먼저 오고 결과 칸이 늦게 와도 움직이지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/tools/crit-speed");
    await expect(page.getByRole("heading", { name: "가정", exact: true })).toBeVisible();
    const r = await page.evaluate(async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      // On a copy of <body> once React has claimed it, as cutEverywhere does (React's commits land on the original).
      const claimed = () => Object.keys(document.body).some((key) => key.startsWith("__reactFiber$"));
      for (let tries = 0; !claimed() && tries < 100; tries++) await new Promise((resolve) => setTimeout(resolve, 50));
      const live = document.body;
      const copy = live.cloneNode(true);
      document.documentElement.replaceChild(copy, live);
      try {
        const settings = copy.querySelector('section[aria-labelledby="settings-heading"]');
        if (!settings) return { found: false };
        const after = [];
        for (let node = settings; node && node !== copy; node = node.parentNode) {
          const siblings = [];
          for (let next = node.nextSibling; next; next = next.nextSibling) siblings.push(next);
          after.push([node.parentNode, siblings]);
        }
        for (const [, siblings] of after) for (const s of siblings) s.remove();
        await frame();
        const entries = [];
        const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
        observer.observe({ type: "layout-shift" });
        for (const [parent, siblings] of after) parent.append(...siblings);
        await frame();
        await frame();
        entries.push(...observer.takeRecords());
        observer.disconnect();
        const box = (b) => `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`;
        return {
          found: true,
          value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(4),
          moved: entries.flatMap((e) => e.sources.map((s) => `${s.node?.nodeName}.${String(s.node?.className ?? "").split(" ")[0]} ${box(s.previousRect)}→${box(s.currentRect)}`)),
        };
      } finally {
        document.documentElement.replaceChild(live, document.body);
      }
    });
    expect(r.found, "가정 칸을 찾지 못함").toBe(true);
    expect(r.value, `결과 칸이 온 뒤 움직인 것: ${r.moved?.slice(0, 4).join(" | ")}`).toBe(0);
  });
