// 회귀(사용자 제보 v0.3.2): 휴대폰에서 캐릭터 화면만 로고가 아이콘뿐이었다(다른 화면은 아이콘 +
// 'LOAKraken'). 모든 화면·너비에서 아이콘과 이름이 함께 보이고, 헤더 높이가 같고, 가로로 넘치지 않는다.
// 캐릭터 화면도 공용 검색 버튼이 있다(헤더 안 검색칸은 900px 이하에서 숨김).
// QA P1(v0.3.1.3): 소개(/about) 360에서 로고 이름과 '캐릭터 검색' 버튼이 겹쳐 글자가 가려지고 버튼이
// 눌리지 않았다. 헤더의 모든 버튼·링크는 가운데를 누르면 자기가 눌리고, 로고 이름 위에 다른 버튼이 없다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const PAGES = [
  ["홈", "/"],
  ["캐릭터", characterPath("상세")],
  ["시세", "/market"],
  ["통계", "/stats"],
  ["소개", "/about"],
];
// The about page's header is the landing's own (fixed): the same height is asked of the others.
const SAME_HEIGHT = new Set(["홈", "캐릭터", "시세", "통계"]);

/**
 * Every control takes its own press at its middle, and none sits on the logo's name.
 * Each finding names both boxes and where they are (left-right px).
 */
const headerClashes = (header) =>
  header.evaluate((head) => {
    const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const controls = [...head.querySelectorAll("a, button")].filter(shown);
    const label = (el) => el.getAttribute("aria-label") || el.textContent.trim().slice(0, 16);
    const at = (el) => {
      const r = el.getBoundingClientRect();
      return `[${Math.round(r.left)}-${Math.round(r.right)}]`;
    };
    const out = [];
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      // The topmost box a finger could see there (a 1px screen-reader-only box is not one).
      const hit = document
        .elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        .find((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 1 && b.height > 1 && getComputedStyle(e).pointerEvents !== "none";
        });
      if (!hit || !el.contains(hit)) {
        const over = hit ? (hit.closest("a, button") ?? hit) : null;
        out.push(`${label(el)} ${at(el)} 가운데를 누르면 ${over ? `${label(over)} ${at(over)}` : "없음"}`);
      }
    }
    const logoName = [...head.querySelectorAll("a span")].find((s) => s.textContent.trim() === "LOAKraken");
    if (logoName) {
      const n = logoName.getBoundingClientRect();
      for (const el of controls) {
        if (el.contains(logoName)) continue;
        const r = el.getBoundingClientRect();
        if (r.left < n.right - 0.5 && r.right > n.left + 0.5 && r.top < n.bottom - 0.5 && r.bottom > n.top + 0.5)
          out.push(`로고 이름 ${at(logoName)} 위에 ${label(el)} ${at(el)}`);
      }
    }
    return out;
  });
for (const width of [320, 360, 390, 1280])
  test(`@로고 ${width}: 모든 화면에서 아이콘 + LOAKraken, 겹침 없음, 헤더 높이 같음, 가로 넘침 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const heights = [];
    for (const [name, path] of PAGES) {
      await gotoReady(page, path);
      const header = page.locator("header").first();
      const brand = header.getByRole("link", { name: /LOAKraken/ }).first();
      await expect(brand.getByText("LOAKraken", { exact: true }), `${name}: 로고 이름`).toBeVisible();
      const cut = await brand.getByText("LOAKraken", { exact: true }).evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(cut, `${name}: 로고 이름 잘림`).toBe(false);
      // The shared search button (the character page at 1280 also has its own search field's button).
      await expect(header.locator("[data-slot=command-search-trigger]"), `${name}: 공용 검색 버튼`).toBeVisible();
      const overflow = await page.evaluate(() => {
        const head = document.querySelector("header");
        return {
          page: document.documentElement.scrollWidth - window.innerWidth,
          header: head ? head.scrollWidth - head.clientWidth : 0,
          outside: head
            ? [...head.querySelectorAll("*")]
                .filter((el) => el.getClientRects().length && el.getBoundingClientRect().right > window.innerWidth + 0.5)
                .map((el) => el.className || el.tagName)
                .slice(0, 3)
            : [],
        };
      });
      expect(overflow, `${name}: 가로 넘침`).toEqual({ page: 0, header: 0, outside: [] });
      expect(await headerClashes(header), `${name}: 헤더 겹침`).toEqual([]);
      if (SAME_HEIGHT.has(name)) heights.push([name, Math.round((await header.boundingBox()).height)]);
    }
    test.info().annotations.push({ type: "헤더 높이", description: JSON.stringify(heights) });
    expect(new Set(heights.map(([, h]) => h)).size, `헤더 높이 ${JSON.stringify(heights)}`).toBe(1);
  });

// Wider fallback fonts (Linux, Android) made the nav links wider, and the character
// page's search ran over 통계 at 1280 (CI). Letter-spacing stands in for those fonts:
// the search gives way, the nav keeps its room.
test("@로고 1280 넓은 글꼴: 캐릭터 화면 헤더 검색칸이 메뉴를 덮지 않음 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoReady(page, characterPath("상세"));
  await page.addStyleTag({ content: "header nav a, header nav button { letter-spacing: 0.3em !important; }" });
  await page.waitForTimeout(200);
  expect(await headerClashes(page.locator("header").first()), "넓은 글꼴 헤더 겹침").toEqual([]);
  // The field opens the search panel since #1113, so it is a combobox.
  await expect(page.locator("header").first().getByRole("combobox", { name: "다른 캐릭터 이름" })).toBeVisible();
});