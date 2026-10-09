// 회귀: OS가 다크 모드여도 주요 화면의 글자가 배경과 충분히 대비된다(WCAG AA 4.5:1).
// 앱은 라이트 테마가 기준이고 캐릭터 배너 일부만 prefers-color-scheme: dark에 반응한다.
// 일부만 다크로 바뀌어 흰 바탕에 흰 글자가 되는 사고를 막는다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

test.use({ colorScheme: "dark" });

/** 요소의 글자색과, 위로 올라가며 처음 만나는 불투명 배경색의 대비. */
async function contrastOf(locator) {
  return locator.evaluate((el) => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const fg = parse(getComputedStyle(el).color);
    let node = el;
    let bg = null;
    while (node && node.nodeType === 1) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a >= 0.95) {
        bg = c;
        break;
      }
      // 배경 이미지·그라데이션 위의 글자는 계산할 수 없다.
      if (getComputedStyle(node).backgroundImage !== "none") return { ratio: null, fg, bg: "image" };
      node = node.parentElement;
    }
    bg ??= { r: 255, g: 255, b: 255, a: 1 };
    const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return { ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, fg, bg };
  });
}

const PAGES = [
  ["/", "홈"],
  ["/market", "시세"],
  ["/tools/refining", "재련"],
  ["/tools/auction", "경매"],
  ["/tools/stone", "돌파고"],
  [characterPath("상세"), "캐릭터"],
  [characterPath("상세", "skills"), "캐릭터 스킬"],
];

test.describe("다크 모드 대비 @regression", () => {
  for (const [path, label] of PAGES) {
    test(`${label}: 제목·본문 글자 대비 4.5 이상`, async ({ page }) => {
      await page.goto(path);
      const targets = [
        page.getByRole("heading", { level: 1 }).first(),
        page.locator("main h2").first(),
        page.locator("main p:visible").first(),
      ];
      let measured = 0;
      for (const target of targets) {
        if (!(await target.count())) continue;
        await expect(target).toBeVisible();
        const result = await contrastOf(target);
        if (result.ratio === null) continue; // 이미지 배경 위 글자는 수동 확인 대상
        measured += 1;
        expect(result.ratio, `${label} ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(measured, `${label}: 대비를 잰 요소가 하나도 없음`).toBeGreaterThan(0);
    });
  }
});
