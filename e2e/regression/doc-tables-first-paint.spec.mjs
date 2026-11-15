// 회귀(A7 첫 로드 흔들림, 남은 화면 훑기: 문서 표): 첫 HTML은 어디서든 끊겨 올 수 있다. 개인정보 처리방침·오픈소스 고지·
// 개발 노트의 표는 자동 배치라 늦게 온 줄이 칸 폭을 다시 정해 먼저 그려진 줄과 머리 칸이 옆으로 움직였다(11-15 훑기:
// /privacy 0.22, /credits 0.11, 개발 노트 0.05). 표 묶음은 끝 표시가 올 때까지 그리지 않는다(data-fp-whole). 본문(main)
// 안의 모든 시작 태그 직후·글자 노드 직후로 잘라도 아무것도 움직이지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const PAGES = [
  ["개인정보 처리방침", "/privacy", "항목"],
  ["오픈소스 고지", "/credits", "쓰는 곳"],
  ["개발 노트", "/news/dev-notes/2026-10-19-test-release", "지금"],
];

for (const [name, path, header] of PAGES)
  for (const width of [360, 1280])
    test(`@A7 ${width} ${name}: 첫 HTML이 어디서 끊겨도 표가 움직이지 않는다 @regression`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, path);
      await page.evaluate(() => document.fonts.ready);
      // The table is drawn once its end mark is in (a lost mark would keep it hidden and pass the cut).
      await expect(page.getByRole("columnheader", { name: header, exact: true }).first()).toBeVisible();
      await expect(page.locator("main table td").first()).toBeVisible();
      const cut = await cutEverywhere(page, "main|");
      expect(cut.probed, cut.moved.join(" / ")).toBeGreaterThan(20);
      expect(cut.value, `늦게 온 부분이 민 것:\n${cut.moved.slice(0, 8).join("\n")}`).toBe(0);
      // Cuts inside the first table itself (codex #1677 P3: main's first screen alone might not reach a table).
      const inTable = await cutEverywhere(page, "[data-fp-whole]:has(> table)|");
      expect(inTable.probed, `표 안을 자른 곳(${inTable.moved.join(" / ")})`).toBeGreaterThan(10);
      expect(inTable.value, `표 안에서 늦게 온 부분이 민 것:\n${inTable.moved.slice(0, 8).join("\n")}`).toBe(0);
    });
