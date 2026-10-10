// Run against the production frontend configured to tests/mock-backend.mjs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:3100";
const mock = process.env.TEST_MOCK_ORIGIN || "http://127.0.0.1:4180";
const output = process.env.TEST_OUTPUT || "test-results";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.TEST_BROWSER || "msedge",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const results = [];
const count = async (name) =>
  (await (await fetch(`${mock}/__counts`)).json())[name] || 0;
const go = async (name) => {
  await page.goto(`${origin}/character/${encodeURIComponent(name)}`);
  await page.locator("h1").waitFor();
};
const check = async (name, fn) => {
  await fn();
  results.push(name);
  console.log(`PASS ${name}`);
};
try {
  await check(
    "SSR data hydrates without a duplicate request or sibling prefetch",
    async () => {
      assert.equal(
        await count("전체"),
        0,
        "Restart the mock before each suite",
      );
      await go("전체");
      await page.getByRole("heading", { name: "장비", exact: true }).waitFor();
      await page.locator("#siblings").scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("online"));
      });
      await page.waitForTimeout(400);
      assert.equal(await count("전체"), 1);
      assert.equal(await count("원정대캐릭터"), 0);
    },
  );
  await check(
    "evidence opens with keyboard and copies actual response value",
    async () => {
      const summary = page.getByText("원본 데이터 보기", { exact: true }).first();
      await summary.focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page.locator("#diagnostics pre").first().innerText(),
        "1",
      );
      await page
        .getByRole("button", { name: "근거 복사", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "복사됨", exact: true }).waitFor();
      const copy = JSON.parse(
        await page.evaluate(() => navigator.clipboard.readText()),
      );
      assert.deepEqual(copy, {
        path: "/data/analysis/arkGrid/inactiveGemCount",
        found: true,
        value: 1,
      });
    },
  );
  await check(
    "manual refresh makes one request and preserves cached source time",
    async () => {
      const stamp = await page.locator("time").getAttribute("datetime");
      await page
        .getByRole("button", { name: "다시 조회", exact: true })
        .click();
      await page.getByText("조회가 완료됐습니다.", { exact: true }).waitFor();
      assert.equal(await count("전체"), 2);
      assert.equal(await page.locator("time").getAttribute("datetime"), stamp);
      await page.reload();
      await page.getByRole("heading", { name: "장비", exact: true }).waitFor();
      assert.equal(await page.locator("h1").innerText(), "전체");
      assert.equal(await count("전체"), 3);
    },
  );
  await check(
    "1440 / 768 / 390 / 320 responsive widths and motion controls",
    async () => {
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(150);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${width}px overflow`,
        );
        await page.screenshot({
          path: `${output}/character-${width}.png`,
          fullPage: true,
        });
      }
      await page.getByRole("button", { name: "모션 일시정지" }).click();
      assert.equal(
        await page.locator("[data-motion]").getAttribute("data-motion"),
        "off",
      );
      await page.getByRole("button", { name: "모션 재생" }).click();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(100);
      assert.equal(
        await page.locator("[data-motion]").getAttribute("data-motion"),
        "off",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
    },
  );
  await check("refresh failure retains data and source timestamp", async () => {
    await go("갱신실패");
    const stamp = await page.locator("time").getAttribute("datetime");
    await page.getByRole("button", { name: "다시 조회", exact: true }).click();
    await page.locator('main [role="alert"], #detail-search-error').waitFor();
    assert.match(
      await page.locator('main [role="alert"], #detail-search-error').innerText(),
      /마지막으로 조회한 정보/,
    );
    assert.equal(await page.locator("#equipment").isVisible(), true);
    assert.equal(await page.locator("time").getAttribute("datetime"), stamp);
    assert.equal(await count("갱신실패"), 2);
  });
  await check(
    "rate limit counts down and never retries automatically",
    async () => {
      await go("제한");
      assert.match(
        await page.locator('main [role="alert"], #detail-search-error').innerText(),
        /조회 요청이 잠시 많아요/,
      );
      assert.equal(
        await page.getByRole("button", { name: /초 후 재조회/ }).isDisabled(),
        true,
      );
      await page
        .getByRole("button", { name: "다시 시도", exact: true })
        .waitFor({ timeout: 5000 });
      assert.equal(await count("제한"), 1);
      await page.waitForTimeout(400);
      assert.equal(await count("제한"), 1);
    },
  );
  await check(
    "not found, bad response, upstream and config errors display distinct safe states",
    async () => {
      for (const [name, text] of [
        ["미존재", "캐릭터를 찾지 못했어요"],
        ["잘못된응답", "조회 결과를 확인할 수 없어요"],
        ["오류", "캐릭터 정보를 불러오지 못했어요"],
        ["설정", "조회 서비스 연결을 준비하고 있어요"],
        ["시간초과", "응답이 늦어지고 있어요"],
      ]) {
        await go(name);
        assert.match(
          await page.locator('main [role="alert"], #detail-search-error').innerText(),
          new RegExp(text),
        );
        assert.doesNotMatch(
          await page.locator("body").innerText(),
          /private upstream detail/,
        );
        assert.equal(await count(name), 1);
      }
    },
  );
  await check(
    "missing data and empty collections remain different observations",
    async () => {
      await go("빈목록");
      assert.match(await page.locator("#gems").innerText(), /빈 목록 제공/);
      assert.match(
        await page.locator("#gems").innerText(),
        /미착용을 의미하지는 않습니다/,
      );
      await go("미제공");
      assert.match(await page.locator("#gems").innerText(), /데이터 미제공/);
      await go("부분");
      assert.equal(await page.locator('main [role="alert"], #detail-search-error').count(), 0);
      assert.match(await page.locator("#gems").innerText(), /데이터 미제공/);
    },
  );
  await check("long names wrap; upstream strings render as text", async () => {
    await go("가".repeat(64));
    assert.equal(await page.locator("h1").innerText(), "가".repeat(64));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await go("문자열");
    assert.match(await page.locator("main").innerText(), /<img src=x/);
    assert.equal(await page.evaluate(() => window.injected), undefined);
  });
  await check(
    "search validation and client navigation use normalized names",
    async () => {
      const input = page.getByLabel("다른 캐릭터 이름");
      await input.fill("a/b");
      await input.press("Enter");
      assert.match(await page.locator('main [role="alert"], #detail-search-error').innerText(), /문자와 숫자/);
      await input.fill("가1");
      await input.press("Enter");
      await page.getByRole("heading", { name: "가1", exact: true }).waitFor();
      assert.equal(await count("가1"), 1);
      await page.goto(origin);
      const search = page.getByPlaceholder("캐릭터 이름을 입력하세요");
      await search.fill("a/b");
      await search.press("Enter");
      await page
        .getByText("캐릭터 이름에는 문자와 숫자만 사용할 수 있어요.")
        .waitFor();
      await search.fill("로딩");
      await search.press("Enter");
      await page.getByText("캐릭터 정보를 조회하고 있어요.").waitFor();
      await page.getByRole("heading", { name: "로딩", exact: true }).waitFor();
      assert.equal(await count("로딩"), 1);
    },
  );
  await check("invalid direct URLs do not reach the backend", async () => {
    await go("bad%name");
    assert.match(
      await page.locator('main [role="alert"], #detail-search-error').innerText(),
      /캐릭터 이름을 확인/,
    );
    assert.equal(await count("bad%name"), 0);
    const response = await fetch(
      `${origin}/api/characters?characterName=${encodeURIComponent("a/b")}`,
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
  await check("JavaScript-disabled visitors get an explicit explanation and a return link", async () => {
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await nojs.newPage();
    await staticPage.goto(`${origin}/character/${encodeURIComponent("전체")}`);
    await staticPage.getByText(/캐릭터 조회 화면을 표시하려면 JavaScript를 켜 주세요/).waitFor();
    assert.equal(await staticPage.getByRole("link", { name: "검색으로 돌아가기", exact: true }).isVisible(), true);
    await nojs.close();
  });
  assert.deepEqual(errors, []);
  writeFileSync(
    `${output}/character-browser-results.json`,
    JSON.stringify(
      {
        passed: results,
        runtimeErrors: errors,
        mockRequests: await (await fetch(`${mock}/__counts`)).json(),
        officialApiCalls: 0,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
