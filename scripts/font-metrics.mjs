// 사이트 글꼴(Kraken Sans)과 이 기기의 시스템 글꼴을 글자 종류별로 잰다(PM 총괄 11-16, 대체 글꼴 맞추기 C안).
// 글꼴 파일은 받지 않는다: 사이트의 woff2(app/fonts)와 이 기기에 이미 있는 글꼴만 쓴다. 결과는 표준 출력과 파일.
// 실행: node scripts/font-metrics.mjs [출력 파일]  (e2e의 @playwright/test와 Chromium을 쓴다)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(new URL("../e2e/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const woff2 = readFileSync(new URL("../app/fonts/kraken-sans.woff2", import.meta.url)).toString("base64");
const out = process.argv[2] ?? "font-metrics.json";

// Faces the site's fallback reaches on each platform, plus the ones a tuned local() fallback could name.
const FAMILIES = [
  "Segoe UI", "Malgun Gothic",
  "Apple SD Gothic Neo", "AppleSDGothicNeo-Regular", "Helvetica Neue", "Helvetica", "system-ui",
  "Roboto", "Noto Sans KR", "Noto Sans CJK KR", "Noto Sans CJK",
  "WenQuanYi Zen Hei", "DejaVu Sans", "Liberation Sans", "Arial", "sans-serif",
];
// Text as the site shows it: numbers, gold, percents; Hangul from labels and names.
const SAMPLES = {
  latin: "0123456789 1,234,567G 22.6% +1,700 ▲580.29 4,120위 Lv.70 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz".replace("위", ""),
  hangul: "전투력 순위 상위 대양 연안 심해 해구 크라켄 클리어 골드 더보기 비용 거래 불가 골드 가치 보스 처치 캐릭터 검색 확인한 길드원 세르카 나이트메어 아이템 레벨 각인 보석 장신구 연마",
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><meta charset=utf-8><body>");
const result = await page.evaluate(
  async ({ woff2, FAMILIES, SAMPLES }) => {
    const kraken = new FontFace("kraken", `url(data:font/woff2;base64,${woff2})`, { weight: "400 700" });
    document.fonts.add(await kraken.load());
    const ctx = document.createElement("canvas").getContext("2d");
    const measure = (family, weight, text) => {
      ctx.font = `${weight} 100px ${family}`;
      const t = ctx.measureText(text);
      return { width: t.width, ascent: t.fontBoundingBoxAscent, descent: t.fontBoundingBoxDescent };
    };
    // A face draws a script itself when the width does not change with the fallback behind it: missing
    // glyphs would come from the site font in one and from the system in the other (both have Hangul).
    const own = (fam, text) => measure(`${fam}, kraken`, 400, text).width === measure(`${fam}, monospace`, 400, text).width;
    const quote = (f) => (/^(sans-serif|system-ui)$/.test(f) ? f : `"${f}"`);
    const rows = {};
    for (const fam of ["kraken", ...FAMILIES]) {
      const q = quote(fam);
      let localOk = null;
      if (!/^(kraken|sans-serif|system-ui)$/.test(fam)) {
        try {
          await new FontFace(`probe-${fam}`, `local("${fam}")`).load();
          localOk = true;
        } catch {
          localOk = false;
        }
      }
      const row = { local: localOk };
      for (const [k, text] of Object.entries(SAMPLES)) {
        row[`${k}Own`] = /^(sans-serif|system-ui)$/.test(fam) ? null : own(q, text);
        for (const weight of [400, 700]) row[`${k}${weight}`] = Math.round(measure(q, weight, text).width * 10) / 10;
      }
      const v = measure(q, 400, "Hg가");
      row.ascent = Math.round(v.ascent * 100) / 100;
      row.descent = Math.round(v.descent * 100) / 100;
      rows[fam] = row;
    }
    // size-adjust that makes each face as wide as the site font, per script and weight (only where the face draws it).
    const k = rows.kraken;
    for (const [fam, row] of Object.entries(rows)) {
      if (fam === "kraken") continue;
      for (const s of ["latin", "hangul"])
        for (const w of [400, 700]) {
          const adjust = row[`${s}${w}`] ? Math.round((k[`${s}${w}`] / row[`${s}${w}`]) * 10000) / 100 : null;
          row[`sizeAdjust_${s}${w}`] = adjust;
          // The @font-face overrides as globals.css takes them (PM-프론트 #1743 P3): the site font's ascent and
          // descent (px at 100px = % of the size) divided by this face's size-adjust, which scales them too. E.g.
          // Segoe UI 400: 95.0 / 1.0424 = 91.14% (globals.css "Kraken Fallback Win").
          row[`ascentOverride_${s}${w}`] = adjust ? Math.round((k.ascent / (adjust / 100)) * 100) / 100 : null;
          row[`descentOverride_${s}${w}`] = adjust ? Math.round((k.descent / (adjust / 100)) * 100) / 100 : null;
        }
    }
    return { userAgent: navigator.userAgent, rows };
  },
  { woff2, FAMILIES, SAMPLES },
);
await browser.close();
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`FONT-METRICS ${result.userAgent}`);
for (const [fam, r] of Object.entries(result.rows))
  console.log(
    `FONT-METRICS ${fam.padEnd(26)} local=${r.local} latinOwn=${r.latinOwn} hangulOwn=${r.hangulOwn} ` +
      `latin=${r.latin400}/${r.latin700} hangul=${r.hangul400}/${r.hangul700} asc=${r.ascent} desc=${r.descent} ` +
      `sizeAdjust latin=${r.sizeAdjust_latin400 ?? "-"}/${r.sizeAdjust_latin700 ?? "-"} hangul=${r.sizeAdjust_hangul400 ?? "-"}/${r.sizeAdjust_hangul700 ?? "-"}` +
      // Ready to paste: ascent-override / descent-override (%) per script and weight (400/700).
      (fam === "kraken"
        ? ""
        : ` overrides(asc/desc %) latin=${r.ascentOverride_latin400 ?? "-"}/${r.descentOverride_latin400 ?? "-"},${r.ascentOverride_latin700 ?? "-"}/${r.descentOverride_latin700 ?? "-"}` +
          ` hangul=${r.ascentOverride_hangul400 ?? "-"}/${r.descentOverride_hangul400 ?? "-"},${r.ascentOverride_hangul700 ?? "-"}/${r.descentOverride_hangul700 ?? "-"}`),
  );
