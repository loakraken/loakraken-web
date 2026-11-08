// 회귀 지킴(A37): 휴대폰 320·360에서 랭킹 조건 칸은 반 줄씩이라 '직업' 선택 상자의 글자 자리가 좁다(320에서 약 75px).
// 가장 긴 직업 이름(디스트로이어·가디언나이트, 6글자)도 말줄임 없이 다 보여야 한다. 웹 글꼴이 오지 않아 더 넓은 대체
// 글꼴로 그려질 때도 같다. 칸 폭·글자 크기·안쪽 여백을 바꿔 이 이름이 잘리면 여기서 걸린다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const NAMES = ["디스트로이어", "가디언나이트"];
const WIDTHS = [320, 360];

/** The chosen class name in the select is drawn whole (and, for the fallback case, without the web font). */
async function expectWhole(page, width, name, fallback) {
  await page.setViewportSize({ width, height: 800 });
  await gotoReady(page, `/rankings?className=${encodeURIComponent(name)}`);
  const form = page.getByRole("form", { name: "랭킹 조건" });
  const select = form.getByRole("combobox", { name: "직업" });
  await expect(select).toContainText(name);
  await page.evaluate(() => document.fonts.ready);
  const text = select.getByText(name, { exact: true });
  const room = await text.evaluate((el) => ({
    shown: el.clientWidth,
    needed: el.scrollWidth,
    family: getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim(),
    loaded: [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family.replace(/["']/g, "")),
  }));
  // The variant really draws without the web font.
  if (fallback) expect(room.loaded, "웹 글꼴이 받아지지 않아야 함").not.toContain(room.family);
  expect(room.needed, `글자 폭 ${room.needed}px, 보이는 폭 ${room.shown}px (${room.family})`).toBeLessThanOrEqual(room.shown);
}

for (const width of WIDTHS)
  for (const name of NAMES)
    test(`@A37 ${width} 랭킹 직업 선택(웹 글꼴): '${name}'이 잘리지 않는다 @regression`, async ({ page }) => {
      await expectWhole(page, width, name, false);
    });

test.describe("대체 글꼴", () => {
  // The aborted web-font requests log "net::ERR_FAILED" by design: only those are let through here; every other
  // console error or page error still fails the test (checked below, as the shared fixture would).
  test.use({ allowConsoleErrors: true });
  for (const width of WIDTHS)
    for (const name of NAMES)
      test(`@A37 ${width} 랭킹 직업 선택(대체 글꼴): '${name}'이 잘리지 않는다 @regression`, async ({ page }) => {
        const errors = [];
        page.on("console", (message) => {
          if (message.type() !== "error") return;
          const source = message.location().url ?? "";
          if (/\.woff2(\?|$)/.test(source) && message.text().includes("net::ERR_FAILED")) return;
          // The shared fixture's other allowances (blocked third-party requests, local socket exhaustion, /api/ 4xx).
          if (source && !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(source)) return;
          if (message.text().includes("net::ERR_NO_BUFFER_SPACE")) return;
          errors.push(message.text());
        });
        page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
        // No web font: the page draws with the system fallback, which is wider.
        await page.route(/\.woff2(\?|$)/, (route) => route.abort());
        await expectWhole(page, width, name, true);
        expect(errors, "웹 글꼴 막음 외의 콘솔 오류가 없어야 한다").toEqual([]);
      });
});
