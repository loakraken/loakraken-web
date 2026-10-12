// 사용자 지적 회귀 점검표(볼트 30 PM/사용자 지적 회귀 점검표) A4~A17의 자동 검사 묶음.
// 이미 있는 스펙이 지키는 줄은 아래 표로 이어 두고, 없는 줄은 이 파일에서 검사한다.
// 태그 @A번호로 한 줄씩 돌릴 수 있다(예: npx playwright test --grep @A6).
//
// | 줄  | 검사 위치 |
// |-----|-----------|
// | A4  | regression/theme-rapid.spec.mjs (10회 연타 뒤 data-theme·배경·전환 0) |
// | A5  | 이 파일: 모든 경로 × 라이트·딤·다크 배경색 |
// | A6  | 이 파일: 모든 경로 첫 로드 layout-shift 합 0 |
// | A7  | 이 파일: 필터·탭·버튼 조작 중 layout-shift 합 0(입력 직후 변화 포함) |
// | A8  | regression/pending-numbers.spec.mjs (A→B→A, 흐림 표시) + 이 파일: keepPreviousData 파일에 isPlaceholderData |
// | A10 | 이 파일: /about 반복 애니메이션이 6초 뒤에도 재생 중 |
// | A14 | regression/scroll-top.spec.mjs (이동 뒤 scrollY 0, 필터는 유지) |
// | A15 | regression/tooltip-below-tabs.spec.mjs (팝업이 탭 바를 덮지 않음) |
// | A16 | 이 파일: 도구 목록의 경로가 모두 헤더 메뉴에 있음 |
// | A17 | 이 파일: 1280에서 헤더 메뉴의 긴 묶음이 2열 이상 |
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  test,
  expect,
  characterPath,
  chooseOption,
  gotoReady,
} from "../support/fixtures.mjs";

const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/privacy",
  "/market",
  "/news",
  "/rankings",
  "/rankings?type=roster",
  "/rankings?type=collectibles",
  "/stats",
  "/schedule",
  "/tools",
  "/tools/auction",
  "/tools/combat-power",
  "/tools/crit-speed",
  "/tools/homework",
  "/tools/material-quote",
  "/tools/more-reward",
  "/tools/raid-rewards",
  "/tools/refining",
  characterPath("상세"),
  characterPath("상세", "skills"),
  characterPath("상세", "collectibles"),
  characterPath("상세", "siblings"),
  characterPath("상세", "arkpassive"),
  characterPath("상세", "stats"),
  characterPath("상세", "simulator"),
  characterPath("상세", "specup"),
];

/**
 * Known first-load shifts found when this bundle was made (2026-10-12), owned
 * by other screens' teams and handed over: marked as expected failures so CI
 * stays green now and turns red the moment one is fixed (then drop the line).
 */
const KNOWN_SHIFT = {
};

/** Collects layout shifts from the very start of the page (buffered), with or without recent input. */
const watchShifts = (page) =>
  page.addInitScript(() => {
    window.__shift = { quiet: 0, input: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        window.__shift[e.hadRecentInput ? "input" : "quiet"] += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
const shifts = (page) =>
  page.evaluate(() => ({
    quiet: +window.__shift.quiet.toFixed(4),
    input: +window.__shift.input.toFixed(4),
  }));

test.describe("사용자 지적 회귀 점검표 @regression", () => {
  test.describe.configure({ mode: "parallel" });

  test.describe("A5", () => {
    // An intermittent hydration retry (React #418) is tracked on its own; here it
    // must not cost the theme, so the theme is checked and the retry is noted.
    test.use({ allowConsoleErrors: true });
    for (const theme of ["light", "dim", "dark"]) {
      test(`@A5 모든 경로가 ${theme} 테마를 따른다`, async ({
        page,
      }, testInfo) => {
        // Every route in one test: under a busy parallel run 60s ran out (3 of
        // 24 repeats timed out on 10-12 with every theme right), so 3x time.
        test.slow();
        // Read after hydration: a hydration retry used to drop data-theme then (10-12).
        let current = "";
        page.on("pageerror", (error) => {
          if (error.message.includes("#418"))
            testInfo.annotations.push({
              type: "hydration-retry",
              description: current,
            });
        });
        await page.addInitScript(
          (t) => localStorage.setItem("loakraken-theme", t),
          theme,
        );
        const wrong = [];
        let expected = null;
        for (const path of ROUTES) {
          current = path;
          await gotoReady(page, path);
          await page.waitForTimeout(200);
          const seen = await page.evaluate(() => ({
            theme: document.documentElement.dataset.theme ?? "light",
            body: getComputedStyle(document.body).backgroundColor,
          }));
          expected ??= seen.body;
          if (seen.theme !== theme || seen.body !== expected)
            wrong.push(`${path}: ${seen.theme} ${seen.body}`);
        }
        expect(wrong, "테마를 따르지 않는 경로").toEqual([]);
      });
    }
  });

  // Two widths (QA 10-12): the wide layout and the phone.
  for (const width of [1280, 360])
    for (const path of ROUTES) {
      test(`@A6 첫 로드 흔들림 0: ${path} @${width}`, async ({ page }) => {
        test.fail(
          `${path}@${width}` in KNOWN_SHIFT,
          KNOWN_SHIFT[`${path}@${width}`],
        );
        await page.setViewportSize({ width, height: 900 });
        await watchShifts(page);
        await gotoReady(page, path);
        await page.waitForTimeout(800);
        expect((await shifts(page)).quiet, `${path} 첫 로드 layout-shift`).toBe(
          0,
        );
      });
    }

  test.describe("404", () => {
    // The 404 page answers 404 by design; its resource error is expected.
    test.use({ allowConsoleErrors: true });
    for (const theme of ["light", "dim", "dark"]) {
      test(`@A5 404 화면도 ${theme} 테마를 따른다`, async ({ page }) => {
        await page.addInitScript(
          (t) => localStorage.setItem("loakraken-theme", t),
          theme,
        );
        await page.goto("/없는-주소");
        expect(
          await page.evaluate(
            () => document.documentElement.dataset.theme ?? "light",
          ),
        ).toBe(theme);
      });
    }
    test("@A6 404 화면 첫 로드 흔들림 0", async ({ page }) => {
      await watchShifts(page);
      await page.goto("/없는-주소");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      expect((await shifts(page)).quiet).toBe(0);
    });
  });

  // A7 (PM-프론트 #589 P1): a control that should grow nothing (a period, a
  // tab, a sort) moves nothing at all, input-triggered shifts included, and
  // stays where it was; a control that opens content below (the ark grid's
  // expand) may push what is under it, so there only shifts with no input count.
  const A7_FLOWS = [
    {
      name: "랭킹 기간",
      path: "/rankings",
      grows: false,
      control: (page) => page.getByRole("combobox", { name: "최근 확인" }),
      act: (page) =>
        chooseOption(
          page,
          page.getByRole("combobox", { name: "최근 확인" }),
          "7일",
        ),
    },
    {
      name: "통계 탭",
      path: "/stats",
      grows: false,
      control: (page) => page.getByRole("tab", { name: "서버" }),
      act: (page) => page.getByRole("tab", { name: "서버" }).click(),
    },
    {
      name: "시세 정렬",
      path: "/market",
      grows: false,
      control: (page) =>
        page
          .getByRole("group", { name: "정렬" })
          .getByRole("button", { name: "고가" }),
      act: (page) =>
        page
          .getByRole("group", { name: "정렬" })
          .getByRole("button", { name: "고가" })
          .click(),
    },
    {
      name: "아크 그리드 펼치기",
      path: characterPath("상세"),
      grows: true,
      control: (page) =>
        page.getByRole("button", { name: "아크 그리드 코어 전체 펼치기" }),
      act: (page) =>
        page
          .getByRole("button", { name: "아크 그리드 코어 전체 펼치기" })
          .click(),
    },
  ];
  // Found by this stricter A7 (10-12 06:0x) and handed to the next front PR
  // (#594): expected failures until fixed, then drop the line.
  const KNOWN_A7 = {
  };
  for (const flow of A7_FLOWS) {
    test(`@A7 ${flow.name}: ${flow.grows ? "아래로 펼치는 것 말고는" : "누른 뒤에도"} 흔들림 0`, async ({
      page,
    }) => {
      test.fail(flow.name in KNOWN_A7, KNOWN_A7[flow.name]);
      await watchShifts(page);
      await gotoReady(page, flow.path);
      await page.waitForTimeout(500);
      const control = flow.control(page);
      const where = async () => {
        const box = await control.boundingBox();
        return box && [Math.round(box.x), Math.round(box.y)];
      };
      const before = await shifts(page);
      const at = await where();
      await flow.act(page);
      await page.waitForTimeout(1200);
      const after = await shifts(page);
      expect(
        (after.quiet - before.quiet).toFixed(4),
        "입력 없이 생긴 흔들림",
      ).toBe("0.0000");
      if (!flow.grows) {
        expect(
          (after.input - before.input).toFixed(4),
          "누른 직후 흔들림",
        ).toBe("0.0000");
        // The pressed control may be gone (a closed list) or renamed; when it is there, it has not moved.
        if (await control.count())
          expect(await where(), "누른 컨트롤 위치").toEqual(at);
      }
    });
  }

  test("@A8 keepPreviousData를 쓰는 파일은 isPlaceholderData(흐림 표시)도 쓴다", async () => {
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx|ts)$/.test(name)) files.push(full);
      }
    };
    walk(
      new URL("../../components", import.meta.url).pathname.replace(
        /^\/([A-Za-z]:)/,
        "$1",
      ),
    );
    const missing = files.filter((f) => {
      const s = readFileSync(f, "utf8");
      return (
        s.includes("keepPreviousData") &&
        !/isPlaceholderData|pendingProps|data-stale/.test(s)
      );
    });
    expect(missing, "흐림 표시 없이 이전 값을 쓰는 파일").toEqual([]);
  });

  test("@A10 반복 애니메이션은 6초 뒤에도 계속 재생한다", async ({ page }) => {
    await gotoReady(page, "/about");
    const running = () =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.effect?.getComputedTiming().iterations === Infinity &&
              a.playState === "running",
          )
          .map((a) => Math.round(Number(a.currentTime))),
      );
    const first = await running();
    expect(first.length, "반복 애니메이션이 있어야 함").toBeGreaterThan(0);
    await page.waitForTimeout(6000);
    const later = await running();
    expect(later.length).toBe(first.length);
    expect(Math.min(...later.map((t, i) => t - first[i]))).toBeGreaterThan(
      5000,
    );
  });

  test("@A16 도구 목록의 경로는 모두 헤더 메뉴에 있다", async ({ page }) => {
    await gotoReady(page, "/tools");
    const tools = await page
      .locator("main a[href^='/tools/']")
      .evaluateAll((links) => [
        ...new Set(links.map((a) => new URL(a.href).pathname)),
      ]);
    expect(tools.length).toBeGreaterThan(3);
    const nav = page.getByRole("navigation", { name: "주요 메뉴" });
    const inMenu = new Set();
    // Menu buttons with a name (the icon-only sheet button is for narrow screens).
    const menus = (
      await nav.locator("button[aria-controls]").evaluateAll((buttons) =>
        buttons.map((b) => ({
          name: b.textContent.trim(),
          panel: b.getAttribute("aria-controls"),
        })),
      )
    ).filter((m) => m.name);
    expect(menus.length).toBeGreaterThan(2);
    for (const { name, panel } of menus) {
      await nav.getByRole("button", { name, exact: true }).click();
      await expect(page.locator(`[id="${panel}"]`)).toBeVisible();
      // Only the flyout of this button: the page itself also links to the tools.
      for (const href of await page
        .locator(`[id="${panel}"] a[href^="/"]`)
        .evaluateAll((links) => links.map((a) => new URL(a.href).pathname)))
        inMenu.add(href);
      await page.keyboard.press("Escape");
    }
    expect(
      tools.filter((t) => !inMenu.has(t)),
      "메뉴에 없는 도구",
    ).toEqual([]);
  });

  test("@A17 1280에서 헤더 메뉴의 긴 묶음은 2열 이상이다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoReady(page, "/market");
    const nav = page.getByRole("navigation", { name: "주요 메뉴" });
    const button = nav.getByRole("button", { name: "성장 도구" });
    const panel = await button.getAttribute("aria-controls");
    await button.click();
    await expect(page.locator(`[id="${panel}"]`)).toBeVisible();
    const columns = await page.evaluate((id) => {
      const lists = [
        ...document.getElementById(id).querySelectorAll("ul"),
      ].filter((ul) => ul.children.length >= 5);
      return lists.map(
        (ul) =>
          new Set(
            [...ul.children].map((li) =>
              Math.round(li.getBoundingClientRect().left),
            ),
          ).size,
      );
    }, panel);
    expect(columns.length).toBeGreaterThan(0);
    expect(Math.min(...columns)).toBeGreaterThanOrEqual(2);
  });
});
