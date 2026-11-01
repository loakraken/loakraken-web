// 회귀(마케팅 10-31): '로아크라켄'으로 찾을 수 있게 — 첫 화면 제목·설명(치적 없음), 첫 HTML에 JSON-LD 하나
// (WebSite·Organization, alternateName), 바닥글 첫 표기, 소개 화면 한 줄. 다른 화면 제목에는 넣지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

test("첫 화면: 제목·설명·JSON-LD가 서버 HTML에 @regression", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain("<title>LOAKraken(로아크라켄) — 로스트아크 캐릭터 검색·시세·성장 도구</title>");
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? "";
  expect(description).toContain("로아크라켄(LOAKraken)");
  expect(description).not.toContain("치적");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  expect(blocks, "JSON-LD 하나").toHaveLength(1);
  const graph = JSON.parse(blocks[0][1])["@graph"];
  expect(graph.map((node) => node["@type"])).toEqual(["WebSite", "Organization"]);
  expect(graph[0].alternateName).toContain("로아크라켄");
  expect(JSON.stringify(graph)).not.toContain("SearchAction");
});

test("다른 화면 제목에는 한글 이름 없음, 소개 화면에는 한 줄, 바닥글 첫 표기 @regression", async ({ page, request }) => {
  const market = await (await request.get("/market")).text();
  expect(market).not.toMatch(/<title>[^<]*로아크라켄/);
  expect(market).not.toContain("application/ld+json");
  await gotoReady(page, "/about");
  await expect(page.getByText("LOAKraken(로아크라켄)은 로스트아크 공식 Open API의 공개 정보로", { exact: false })).toBeVisible();
  await expect(page.locator("footer, [class*=legal]").getByText(/LOAKraken\(로아크라켄\)은 Smilegate RPG와 무관한/).first()).toBeAttached();
});
