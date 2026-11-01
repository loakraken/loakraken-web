// 내 API 키(BYOK)는 기본으로 꺼져 있다: 꺼진 배포에는 설정 화면·키 경로·들어가는 링크가 없다.
// 켠 상태는 playwright.byok.config.mjs(e2e/byok/)가 따로 본다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("플래그가 꺼지면 /settings/api-key·/api/byok가 404, 바닥글·한도 안내에 링크가 없다 @regression", async ({ page }) => {
  expect((await page.request.get("/settings/api-key")).status()).toBe(404);
  expect((await page.request.get("/api/byok")).status()).toBe(404);
  expect((await page.request.post("/api/byok", { data: { key: "lktest.valid.a1b2" } })).status()).toBe(404);
  expect((await page.request.delete("/api/byok")).status()).toBe(404);

  await gotoReady(page, characterPath("제한"));
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "내 API 키로 조회하기" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "사이트 정책" }).getByRole("link")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "내 API 키" })).toHaveCount(0);
});
