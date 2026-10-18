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
});
