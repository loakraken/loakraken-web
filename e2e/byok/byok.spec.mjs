// 내 API 키(BYOK, api #804) — 플래그를 켠 서버(playwright.byok.config.mjs)에서만 돈다.
// 키는 모두 시험용 합성 값이다(세 부분 base64url 모양만 맞춘다). 목은 가운데 부분이
// "invalid"이면 401 USER_KEY_INVALID로 답하고, 받은 키의 끝 네 글자만 /__userkeys에 남긴다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const MOCK = `http://127.0.0.1:${process.env.E2E_MOCK_PORT ?? 3201}`;
const VALID = "lktest.valid.a1b2";
const INVALID = "lktest.invalid.c3d4";
const FORGED = "lktest.forged.e5f6";
const COOKIE = "__Host-lk_key";

const seenKey = async (request, kind, name) => (await (await request.get(`${MOCK}/__userkeys`)).json())[`${kind}:${name}`];
const keyCookie = async (context) => (await context.cookies()).find((cookie) => cookie.name === COOKIE);

async function register(page, key, { remember = false } = {}) {
  await gotoReady(page, "/settings/api-key");
  await page.getByLabel(/API 키|다른 키로 바꾸기/).fill(key);
  if (remember) await page.getByRole("checkbox", { name: /기억/ }).check();
  await page.getByRole("button", { name: "키 등록" }).click();
  await expect(page.getByRole("status").filter({ hasText: "키를 등록했어요" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // Any CSP report on these pages fails the test (the panel and its fetches run under the enforced policy).
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
});

test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => window.__csp ?? []), "CSP 위반이 없어야 한다").toEqual([]);
});

test("키 등록: 봉인 쿠키 속성, 화면엔 끝 네 글자만, 검색에 내 키를 쓰고 지우면 끊긴다 @regression", async ({ page, context }) => {
  await register(page, VALID);
  const field = page.getByLabel("다른 키로 바꾸기");
  await expect(field, "보낸 뒤 입력란은 비운다").toHaveValue("");
  await expect(page.getByText("…a1b2", { exact: true })).toBeVisible();

  const cookie = await keyCookie(context);
  expect(cookie, "봉인 쿠키가 있어야 한다").toBeTruthy();
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/" });
  expect(cookie.expires, "기억하지 않으면 세션 쿠키").toBe(-1);
  expect(cookie.value).not.toContain(VALID);
  expect(await page.evaluate(() => document.cookie), "페이지 스크립트는 쿠키를 읽지 못한다").not.toContain("lk_key");

  // The status answer carries the hint only, never the key.
  const status = await page.evaluate(async () => (await fetch("/api/byok")).text());
  expect(status).not.toContain(VALID);
  expect(JSON.parse(status).data).toMatchObject({ set: true, hint: "…a1b2" });
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(VALID);

  await gotoReady(page, characterPath("내키검색"));
  await expect(page.getByRole("heading", { level: 1, name: "내키검색" })).toBeVisible();
  expect(await seenKey(page.request, "search", "내키검색"), "검색 요청에 내 키가 실린다").toBe("a1b2");

  await gotoReady(page, "/settings/api-key");
  await page.getByRole("button", { name: "키 지우기" }).click();
  await expect(page.getByRole("status").filter({ hasText: "키를 지웠어요" })).toBeVisible();
  expect(await keyCookie(context)).toBeUndefined();
  await gotoReady(page, characterPath("키지운뒤"));
  await expect(page.getByRole("heading", { level: 1, name: "키지운뒤" })).toBeVisible();
  expect(await seenKey(page.request, "search", "키지운뒤"), "지운 뒤엔 공용 키(헤더 없음)").toBeNull();
});

test("이 브라우저에서 기억: 7일 쿠키 @regression", async ({ page, context }) => {
  await register(page, VALID, { remember: true });
  const cookie = await keyCookie(context);
  const days = (cookie.expires * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(6.9);
  expect(days).toBeLessThanOrEqual(7);
});

test("형식이 틀린 키는 보내지 않고 입력란에 오류를 잇는다 @regression", async ({ page, context }) => {
  await gotoReady(page, "/settings/api-key");
  const field = page.getByLabel("API 키");
  await field.fill("not-a-key");
  await page.getByRole("button", { name: "키 등록" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "키 형식이 맞지 않아요" })).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toBeFocused();
  expect(await keyCookie(context)).toBeUndefined();
});

test("공식 API가 키를 거절하면(USER_KEY_INVALID) 안내하고 쿠키를 지운다 @regression", async ({ page, context }) => {
  await register(page, INVALID);
  await gotoReady(page, characterPath("키거절"));
  await expect(page.getByRole("alert").filter({ hasText: "등록한 API 키를 쓸 수 없어요" })).toBeVisible();
  // The page render cannot set cookies; the next read through /api/characters clears it.
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect.poll(() => keyCookie(context)).toBeUndefined();
  await gotoReady(page, "/settings/api-key");
  await expect(page.getByText("없음 (사이트 공용 키로 조회해요)")).toBeVisible();
});

test("브라우저가 보낸 X-LK-User-Key는 api에 닿지 않는다 @regression", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-LK-User-Key": FORGED });
  await gotoReady(page, characterPath("위조헤더"));
  await expect(page.getByRole("heading", { level: 1, name: "위조헤더" })).toBeVisible();
  expect(await seenKey(page.request, "search", "위조헤더"), "페이지 요청").toBeNull();
  const api = await page.request.get(`/api/characters?characterName=${encodeURIComponent("위조헤더2")}`, {
    headers: { "X-LK-User-Key": FORGED },
  });
  expect(api.ok()).toBe(true);
  expect(await seenKey(page.request, "search", "위조헤더2"), "/api 요청").toBeNull();
});

test("공용 한도 안내와 바닥글에서 내 API 키로 간다, 내 몫 한도에는 링크가 없다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("제한"));
  const link = page.getByRole("link", { name: "내 API 키로 조회하기" });
  await expect(link).toHaveAttribute("href", "/settings/api-key");
  await expect(page.getByRole("navigation", { name: "사이트 정책" }).getByRole("link", { name: "내 API 키" })).toHaveAttribute(
    "href",
    "/settings/api-key",
  );
  await gotoReady(page, characterPath("과다"));
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "내 API 키로 조회하기" })).toHaveCount(0);
});
