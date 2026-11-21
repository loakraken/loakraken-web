// 회귀 가드(#1860 · #1864 검토 P3, PM 총괄 11-21 성능 점검): 캐릭터 페이지의 첫 JS(서버 HTML이 부르는 스크립트)에 motion
// 라이브러리가 없다. motion/react는 하나의 묶음이라 어디서든 바로 가져오면 통째로(추정 gzip 55KB) 다시 들어온다.
// 표지 글자는 motion이 압축 뒤에도 그대로 남기는 문자열. 소개 페이지는 자체 움직임으로 motion을 바로 받으므로 표지가
// 있어야 한다(표지가 맞는지의 확인).
import { test, expect, characterPath } from "../support/fixtures.mjs";

const MARKERS = ["framerAppearId", "BeforeLayoutMeasure"];

/** The scripts the server HTML loads (the nomodule polyfill aside) and whether each holds a motion marker. */
async function firstLoadScripts(page, baseURL, path) {
  const html = await (await page.request.get(new URL(path, baseURL).toString())).text();
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"([^>]*)>/g)]
    .filter(([, , rest]) => !/noModule/i.test(rest))
    .map(([, src]) => src);
  return Promise.all(
    srcs.map(async (src) => {
      const body = await (await page.request.get(new URL(src, baseURL).toString())).text();
      return { src, motion: MARKERS.filter((m) => body.includes(m)) };
    }),
  );
}

test("캐릭터 페이지 첫 JS에 motion이 없다(소개 페이지에는 있다) @regression", async ({ page, baseURL }) => {
  const character = await firstLoadScripts(page, baseURL, characterPath("상세"));
  expect(character.length, "첫 로드 스크립트").toBeGreaterThan(5);
  expect(character.filter((s) => s.motion.length).map((s) => `${s.src}: ${s.motion.join(", ")}`), "motion이 든 첫 로드 스크립트").toEqual([]);
  const about = await firstLoadScripts(page, baseURL, "/about");
  expect(about.some((s) => s.motion.length), "소개 페이지는 motion을 바로 받음(표지 확인)").toBe(true);
});
