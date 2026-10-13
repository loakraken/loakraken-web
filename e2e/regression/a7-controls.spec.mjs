// 회귀(점검표 A7, 10-13): 경로마다 필터·탭·정렬 버튼을 하나씩 눌러, 누른 직후(hadRecentInput)를
// 포함한 layout-shift 합이 0인지 본다. user-checklist의 A7 흐름은 손으로 고른 몇 개라
// 새 화면의 버튼은 이 파일이 덮는다.
// 대상: main 안의 role=group 버튼, role=tablist 탭, role=radiogroup 라디오 중 지금 눌려 있지
// 않고 누를 수 있는 것(경로마다 앞에서 14개까지). 다른 경로로 가는 탭은 이동 뒤 원래 경로로 돌아온다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const ROUTES = [
  "/",
  "/market",
  "/market/gems",
  "/market/accessories",
  "/news",
  "/rankings",
  "/rankings?type=roster",
  "/rankings?type=collectibles",
  "/rankings?type=guilds",
  "/rankings?type=efficiency",
  "/stats",
  "/schedule",
  "/tools/auction",
  "/tools/crit-speed",
  "/tools/material-quote",
  "/tools/more-reward",
  "/tools/raid-rewards",
  "/tools/refining",
  characterPath("상세"),
  characterPath("상세", "skills"),
  characterPath("상세", "collectibles"),
  characterPath("상세", "siblings"),
  characterPath("상세", "arkpassive"),
  characterPath("상세", "specup"),
];

const CONTROLS = "main [role=group] button, main [role=tablist] [role=tab], main [role=radiogroup] [role=radio]";

/**
 * Found when this check was added (10-13, input-inclusive for the first
 * time): expected failures until the screen is fixed, so CI stays green now
 * and turns red the moment one is fixed (then drop the line).
 */
const FOUND = "10-13 A7 전수 측정에서 발견, 정리 대기";
const KNOWN = Object.fromEntries(
  [
  ].map((key) => [key, FOUND]),
);

for (const width of [1280, 360])
  for (const path of ROUTES)
    test(`@A7 ${path} 버튼·탭 누른 직후 포함 흔들림 0 @${width} @regression`, async ({ page }) => {
      test.slow();
      test.fail(`${path}@${width}` in KNOWN, KNOWN[`${path}@${width}`]);
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, path);
      await page.waitForTimeout(600);
      const controls = page.locator(CONTROLS);
      const count = Math.min(await controls.count(), 14);
      const moved = [];
      for (let i = 0; i < count; i++) {
        const control = controls.nth(i);
        if (!(await control.isVisible())) continue;
        const pressed = await control.evaluate(
          (el) => (el.getAttribute("aria-pressed") ?? el.getAttribute("aria-selected") ?? el.getAttribute("aria-checked")) === "true",
        );
        if (pressed) continue;
        // Disabled (or covered) controls take no press; a trial click finds them without acting.
        const pressable = await control
          .click({ trial: true, timeout: 2000 })
          .then(() => true, () => false);
        if (!pressable || (await control.getAttribute("aria-disabled")) === "true") continue;
        const name = await control.evaluate((el) => {
          const group = el.closest("[role=group],[role=tablist],[role=radiogroup]")?.getAttribute("aria-label") ?? "";
          const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
          return `${group}/${label.slice(0, 30)}`;
        });
        const from = new URL(page.url()).pathname;
        const shift = await shiftsDuring(page, () => control.click());
        if (shift.all > 0) moved.push(`${name}: ${shift.all} (${shift.moved})`);
        if (new URL(page.url()).pathname !== from) {
          await gotoReady(page, path);
          await page.waitForTimeout(600);
        }
      }
      expect(moved, `${path} @${width}: 누른 뒤 흔들린 버튼`).toEqual([]);
    });
