// codex #1895 P2: a tool's picks follow an address change from outside — a link to the same page (Next keeps the
// component, so the state used to stay) and back · forward between that page's entries. Plus the 레이드 보상표 address
// stays clean: a card back on its first difficulty leaves it (codex #1895 P3).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const param = (page, key) => new URL(page.url()).searchParams.get(key);

test("레이드 보상표: 같은 화면 링크(기본 주소)로 분류가 처음으로, 뒤로·앞으로가 고른 분류를 따라간다", async ({ page }) => {
  await gotoReady(page, "/tools/raid-rewards");
  const chips = page.getByRole("group", { name: "레이드 분류" });
  const kazeros = chips.getByRole("button", { name: "카제로스 레이드" });
  const all = chips.getByRole("button", { name: "전체" });
  await kazeros.click();
  await expect.poll(() => param(page, "filter")).toBe("KAZEROS");

  // The hub tab of this very page: the default address, and the chips with it.
  await page.getByRole("navigation", { name: "레이드 화면" }).getByRole("link", { name: "보상표" }).click();
  await expect.poll(() => param(page, "filter")).toBeNull();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(kazeros).toHaveAttribute("aria-pressed", "false");

  await page.goBack();
  await expect.poll(() => param(page, "filter")).toBe("KAZEROS");
  await expect(kazeros).toHaveAttribute("aria-pressed", "true");
  // Taking the address in writes nothing back over it.
  await page.waitForTimeout(300);
  expect(param(page, "filter")).toBe("KAZEROS");

  await page.goForward();
  await expect.poll(() => param(page, "filter")).toBeNull();
  await expect(all).toHaveAttribute("aria-pressed", "true");
});

test("레이드 보상표: 하드 → 노말로 돌리면 그 카드 짝이 주소에서 빠진다", async ({ page }) => {
  await gotoReady(page, "/tools/raid-rewards");
  const act1 = page.getByRole("radiogroup", { name: "1막 난이도" });
  await act1.getByRole("radio", { name: "하드" }).click();
  await expect.poll(() => param(page, "difficulty")).toBe("kazeros-act1:HARD");
  await act1.getByRole("radio", { name: "노말" }).click();
  await expect.poll(() => param(page, "difficulty")).toBeNull();
  await expect(act1.getByRole("radio", { name: "노말" })).toBeChecked();
});

test("레이드 보상표: 짝이 아닌 값('…:HARD:garbage')은 버리고 첫 난이도", async ({ page }) => {
  await gotoReady(page, "/tools/raid-rewards?difficulty=kazeros-act1:HARD:garbage");
  await expect(page.getByRole("radiogroup", { name: "1막 난이도" }).getByRole("radio", { name: "노말" })).toBeChecked();
  await expect.poll(() => param(page, "difficulty")).toBeNull();
});

// codex #1895 follow-up P3 (1): the pick and a click on this page's tab in one task, so the router never reports the
// pick before the tab's default address (null → KAZEROS → null shows as null → null). The chips still follow it.
test("레이드 보상표: 고르자마자 같은 화면 탭을 눌러도(라우터가 고른 값을 알리기 전) 분류가 처음으로", async ({ page }) => {
  await gotoReady(page, "/tools/raid-rewards");
  const chips = page.getByRole("group", { name: "레이드 분류" });
  await page.evaluate(() => {
    const chip = [...document.querySelectorAll('[aria-label="레이드 분류"] button')].find((b) => b.textContent === "카제로스 레이드");
    const tab = [...document.querySelectorAll('nav[aria-label="레이드 화면"] a')].find((a) => a.textContent === "보상표");
    chip.click();
    tab.click();
  });
  await expect.poll(() => param(page, "filter")).toBeNull();
  await expect(chips.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(400);
  expect(param(page, "filter")).toBeNull();
  await expect(chips.getByRole("button", { name: "카제로스 레이드" })).toHaveAttribute("aria-pressed", "false");
});

// codex #1895 follow-up P3 (2): a value the page does not have shows the default, and the address is brought to what is
// shown (the hook writes the shown value; documented in useUrlState).
test("레이드 보상표: 없는 분류(?filter=INVALID)는 전체로, 주소도 그에 맞춘다", async ({ page }) => {
  await gotoReady(page, "/tools/raid-rewards?filter=INVALID");
  await expect(page.getByRole("group", { name: "레이드 분류" }).getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => param(page, "filter")).toBeNull();
});