// 회귀(검색 결과 파비콘): 검색 결과에 우리 표 대신 빈 지구본이 떴다. /favicon.ico가 404였고, 아이콘은 바탕 없는
// SVG 하나뿐이었다. 이제 /favicon.ico가 200(16·32·48)이고, 첫 화면 머리에 브라우저용 SVG와 함께 48의 배수인
// 192 PNG(바탕 칸이 있는)가 걸린다. 파일 모양(크기·바탕·표)은 tests/favicons.test.ts가 지킨다.
import { readFileSync } from "node:fs";
import { test, expect } from "../support/fixtures.mjs";

const app = (file) => readFileSync(new URL(`../../app/${file}`, import.meta.url));
const icons = (html) =>
  [...html.matchAll(/<link [^>]*rel="icon"[^>]*>/g)].map(([tag]) => ({
    href: tag.match(/href="([^"]+)"/)?.[1] ?? "",
    sizes: tag.match(/sizes="([^"]+)"/)?.[1] ?? null,
    type: tag.match(/type="([^"]+)"/)?.[1] ?? null,
  }));

test("검색 결과 파비콘: /favicon.ico는 200 · 아이콘 형식, 첫 화면 머리에 ico · svg · 192 png @regression", async ({ request }) => {
  const favicon = await request.get("/favicon.ico");
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()["content-type"]).toMatch(/^image\/(x-icon|vnd\.microsoft\.icon)/);
  expect(Buffer.compare(await favicon.body(), app("favicon.ico"))).toBe(0);

  const links = icons(await (await request.get("/")).text());
  const path = (href) => new URL(href, "http://x").pathname;
  expect(links.map(({ href }) => path(href)).sort()).toEqual(["/favicon.ico", "/icon.svg", "/icon1.png"]);
  const png = links.find(({ href }) => path(href) === "/icon1.png");
  expect(png).toMatchObject({ sizes: "192x192", type: "image/png" });
  const svg = links.find(({ href }) => path(href) === "/icon.svg");
  expect(svg).toMatchObject({ type: "image/svg+xml" });

  const raster = await request.get(png.href);
  expect(raster.status()).toBe(200);
  expect(raster.headers()["content-type"]).toMatch(/^image\/png/);
  expect(Buffer.compare(await raster.body(), app("icon1.png"))).toBe(0);
});
