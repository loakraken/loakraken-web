// 성장 도구 입력 유지(#889, QA 10-18 P1): 값을 넣고 다른 화면에 갔다가 뒤로 오거나 새로고침해도
// 넣은 값이 그대로다. 모든 도구가 멀티서치와 같은 한 가지 방식(주소에 값을 둠)을 쓴다.
import { test, expect, gotoReady, chooseOption } from "../support/fixtures.mjs";

// Phones fold the 아비도스 conditions under the results: open them before typing.
async function openFold(page) {
  const toggle = page.getByRole("button", { name: /^계산 조건/ });
  if (await toggle.isVisible().catch(() => false)) {
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  }
}

async function awayAndBack(page) {
  await page.goto("/tools");
  await page.goBack();
}

const TOOLS = [
  {
    name: "아비도스 제작 손익",
    path: "/tools/abidos-craft",
    fill: async (page) => {
      await openFold(page);
      await page.getByRole("textbox", { name: "대성공 확률 증가" }).fill("10");
      await page.getByRole("textbox", { name: "제작 수수료 감소" }).fill("17");
      await page.getByRole("switch", { name: "교환 상인" }).click();
    },
    check: async (page) => {
      await openFold(page);
      await expect(page.getByRole("textbox", { name: "대성공 확률 증가" })).toHaveValue("10");
      await expect(page.getByRole("textbox", { name: "제작 수수료 감소" })).toHaveValue("17");
      await expect(page.getByRole("switch", { name: "교환 상인" })).not.toBeChecked();
    },
  },
  {
    name: "생명의 기운 효율",
    path: "/tools/life-energy",
    fill: async (page) => {
      await page.getByRole("textbox", { name: "쓸 생명의 기운" }).fill("1000");
      await page.getByRole("switch", { name: "베아트리스의 축복" }).click();
    },
    check: async (page) => {
      await expect(page.getByRole("textbox", { name: "쓸 생명의 기운" })).toHaveValue("1000");
      await expect(page.getByRole("switch", { name: "베아트리스의 축복" })).toBeChecked();
    },
  },
  {
    name: "기여도 계산기",
    path: "/tools/contribution",
    fill: async (page) => {
      await chooseOption(page, page.getByRole("combobox", { name: "레이드" }), "세르카");
      await chooseOption(page, page.getByRole("combobox", { name: "난이도" }), "하드");
      await page.getByRole("textbox", { name: "내 피해량(억)" }).fill("2555.6");
    },
    check: async (page) => {
      await expect(page.getByRole("combobox", { name: "레이드" })).toHaveText(/세르카/);
      await expect(page.getByRole("combobox", { name: "난이도" })).toHaveText(/하드/);
      await expect(page.getByRole("textbox", { name: "내 피해량(억)" })).toHaveValue("2555.6");
      await expect(page.getByRole("region", { name: "세르카 하드 1관문" })).toBeVisible();
    },
  },
  {
    name: "치적·뭉가·음돌",
    path: "/tools/crit-speed",
    fill: async (page) => {
      await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("상세");
      await page.getByRole("button", { name: "계산하기" }).click();
      await page.getByRole("spinbutton", { name: /^스킬 트라이포드 치적/ }).fill("12");
      await page.getByRole("spinbutton", { name: /^공격 속도/ }).fill("8");
    },
    check: async (page) => {
      await expect(page.getByRole("textbox", { name: "캐릭터 이름" })).toHaveValue("상세");
      await expect(page.getByRole("spinbutton", { name: /^스킬 트라이포드 치적/ })).toHaveValue("12");
      await expect(page.getByRole("spinbutton", { name: /^공격 속도/ })).toHaveValue("8");
    },
  },
  {
    name: "재련 계획",
    path: "/tools/refining",
    fill: async (page) => {
      await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("재련");
      await page.getByRole("button", { name: "장비 불러오기" }).click();
      await expect(page.getByText(/재련 · 루페온 · 아이템 레벨/)).toBeVisible();
      await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+25" }).click();
    },
    check: async (page) => {
      await expect(page.getByRole("textbox", { name: "캐릭터 이름" })).toHaveValue("재련");
      // 장비를 다시 불러오고, 고른 목표 단계는 그대로다.
      await expect(page.getByText(/재련 · 루페온 · 아이템 레벨/)).toBeVisible();
      await expect(page.getByRole("group", { name: "무기" }).getByRole("combobox", { name: "목표" })).toHaveText("+25");
    },
  },
  {
    name: "재료 구매 견적",
    path: "/tools/material-quote",
    fill: async (page) => {
      await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();
      await page.getByRole("combobox", { name: "재료 이름" }).fill("합성");
    },
    check: async (page) => {
      await expect(page.getByRole("combobox", { name: "재료 이름" })).toHaveValue("합성");
    },
  },
];

test.describe("성장 도구 입력 유지", () => {
  for (const tool of TOOLS) {
    test(`${tool.name}: 다른 화면에 갔다가 뒤로 와도, 새로고침해도 넣은 값이 남는다`, async ({ page }) => {
      await gotoReady(page, tool.path);
      await tool.fill(page);
      // The address has caught up with the last input before leaving.
      await page.waitForTimeout(300);
      await awayAndBack(page);
      await tool.check(page);
      await page.reload();
      await tool.check(page);
    });
  }

  // #897(PM-프론트 #896 판단): 견적에 담은 줄은 품목 id·필요·보유만 주소에 두고, 새로고침·공유 주소에서 품목을 다시 불러온다.
  test("재료 구매 견적: 담은 줄과 필요·보유 수가 새로고침에도 남는다", async ({ page }) => {
    await gotoReady(page, "/tools/material-quote");
    await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();
    await page.getByRole("combobox", { name: "재료 이름" }).fill("합성");
    await page.getByRole("option", { name: "합성 재련 재료 견적에 추가" }).click();
    await page.getByRole("textbox", { name: "필요", exact: true }).fill("250");
    await page.getByRole("textbox", { name: "보유", exact: true }).fill("30");
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.getByRole("heading", { name: "재료 1/10" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "필요", exact: true })).toHaveValue("250");
    await expect(page.getByRole("textbox", { name: "보유", exact: true })).toHaveValue("30");
    // 다시 찾지 못한 줄이 없으니 안내도 없다.
    await expect(page.getByText(/다시 찾지 못했어요/)).toHaveCount(0);
  });

  // PM-프론트 #899 P2: 새로고침 때 검색이 막히면(429) 그 줄은 버리지 않고 '다시 불러오기'로 남는다.
  test("재료 구매 견적: 다시 불러오기가 막히면 그 줄은 남고, 다시 불러오기로 돌아온다", async ({ page }) => {
    await gotoReady(page, "/tools/material-quote");
    await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();
    await page.getByRole("combobox", { name: "재료 이름" }).fill("합성");
    await page.getByRole("option", { name: "합성 재련 재료 견적에 추가" }).click();
    await page.getByRole("textbox", { name: "필요", exact: true }).fill("250");
    await page.waitForTimeout(300);
    let blocked = true;
    await page.route("**/api/markets/items**", (route) =>
      blocked
        ? route.fulfill({
            status: 429,
            contentType: "application/json",
            headers: { "Retry-After": "1" },
            body: JSON.stringify({ ok: false, error: { code: "CLIENT_RATE_LIMITED", status: 429 } }),
          })
        : route.fallback(),
    );
    await page.reload();
    await expect(page.getByText("담아 둔 재료 1개를 지금 불러오지 못했어요.")).toBeVisible();
    // 그 줄은 주소에 남아 있어 다시 새로고침해도 잃지 않는다.
    expect(new URL(page.url()).searchParams.get("items")).toContain('"r":"250"');
    blocked = false;
    await page.getByRole("button", { name: "다시 불러오기" }).click();
    await expect(page.getByRole("textbox", { name: "필요", exact: true })).toHaveValue("250");
    await expect(page.getByText(/지금 불러오지 못했어요/)).toHaveCount(0);
  });
});
