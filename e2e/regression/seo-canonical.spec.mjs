// 회귀(A6 검색 노출, 캐릭터 색인 켜기 전 점검): 사이트맵의 모든 주소는 열리고(200), 자기 주소를
// canonical로 가리키며 noindex가 아니다. 공유 주소처럼 쿼리가 붙은 도구 화면도 canonical은 쿼리 없는
// 자기 주소라 같은 화면이 여러 주소로 색인되지 않는다.
import { test, expect } from "../support/fixtures.mjs";

const canonicalOf = (html) => html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
const robotsOf = (html) => html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? null;

test("@A6 사이트맵 주소는 모두 200·자기 canonical·noindex 아님 @regression", async ({ request }) => {
  test.setTimeout(120_000);
  const xml = await (await request.get("/sitemap.xml")).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]));
  expect(urls.length).toBeGreaterThan(20);
  const wrong = [];
  for (const url of urls) {
    const path = url.pathname;
    const response = await request.get(path);
    const html = await response.text();
    const canonical = canonicalOf(html);
    if (response.status() !== 200) wrong.push(`${path}: ${response.status()}`);
    else if (!canonical || new URL(canonical).pathname !== path) wrong.push(`${path}: canonical ${canonical}`);
    else if (robotsOf(html)?.includes("noindex")) wrong.push(`${path}: ${robotsOf(html)}`);
  }
  expect(wrong, wrong.join("\n")).toEqual([]);
});

test("@A6 쿼리가 붙은 도구 주소도 canonical은 쿼리 없는 자기 주소 @regression", async ({ request }) => {
  for (const path of ["/tools/refining", "/tools/material-quote", "/tools/auction"]) {
    const html = await (await request.get(`${path}?share=1`)).text();
    const canonical = canonicalOf(html);
    expect(canonical, path).not.toBeNull();
    expect(new URL(canonical).pathname, path).toBe(path);
    expect(new URL(canonical).search, path).toBe("");
  }
});
