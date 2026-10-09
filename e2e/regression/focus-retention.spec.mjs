// 회귀: 키보드로 실행한 뒤 로딩 중·완료 후 포커스가 BODY로 사라지지 않는다.
// web #89 검토에서 공통 Button의 로딩(disabled) 때문에 포커스가 BODY로 빠진 P1이 나왔다.
// 공통 부품을 아직 쓰지 않는 화면도 같은 문제가 생길 수 있어 실제 흐름으로 확인한다.
// web #106(성장 도구 3화면 포커스 유실)은 #113에서 고쳤다. 응답을 1.2초 늦춰 로딩 상태를 만든다.
import { test, expect } from "../support/fixtures.mjs";

const slow = (page, pattern) =>
  page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });

const activeTag = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el ? `${el.tagName}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""}:${(el.textContent ?? "").trim().slice(0, 20)}` : "null";
  });

async function expectFocusKept(page, label) {
  const tag = await activeTag(page);
  expect(tag.startsWith("BODY") || tag === "null", `${label}: 포커스가 BODY로 사라짐 (${tag})`).toBe(false);
}

const FLOWS = [
  {
    name: "치적·뭉가·음돌 계산하기",
    path: "/tools/crit-speed",
    api: "**/api/crit-speed**",
    start: async (page) => {
      await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("상세");
      await page.getByRole("button", { name: "계산하기" }).focus();
    },
    done: (page) => page.getByText(/규칙 crit-speed-v\d+/),
  },
  {
    name: "재련 장비 불러오기",
    path: "/tools/refining",
    api: "**/api/characters?**",
    start: async (page) => {
      await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("재련");
      await page.getByRole("button", { name: "장비 불러오기" }).focus();
    },
    done: (page) => page.getByText(/재련 · 루페온 · 아이템 레벨/),
  },
  {
    name: "재료 견적 검색",
    path: "/tools/material-quote",
    api: "**/api/markets/items**",
    start: async (page) => {
      await expect(page.getByRole("combobox", { name: "카테고리" })).toBeEnabled();
      await page.getByRole("textbox", { name: "재료 이름" }).fill("합성");
      await page.getByRole("button", { name: "검색", exact: true }).focus();
    },
    done: (page) => page.getByRole("button", { name: "합성 재련 재료 견적에 추가" }),
  },
  {
    name: "시세 분류 전환",
    path: "/market",
    api: "**/api/markets/board**",
    start: async (page) => {
      await expect(page.getByRole("region", { name: /재련 재료 시세/ }).getByRole("listitem").first()).toBeVisible();
      await page.getByRole("navigation", { name: "시세 분류" }).getByRole("button", { name: "각인서" }).focus();
    },
    done: (page) => page.getByRole("heading", { name: /각인서 시세/ }),
  },
];

test.describe("로딩 중 포커스 유지 @regression", () => {
  for (const flow of FLOWS) {
    test(flow.name, async ({ page }) => {
      await page.goto(flow.path);
      await slow(page, flow.api);
      await flow.start(page);
      await page.keyboard.press("Enter");
      // 로딩 중
      await page.waitForTimeout(400);
      await expectFocusKept(page, `${flow.name} 로딩 중`);
      // 완료 후
      await expect(flow.done(page)).toBeVisible();
      await expectFocusKept(page, `${flow.name} 완료 후`);
    });
  }
});
