// 레이드 보상표(/tools/raid-rewards, web #139)와 숙제 체크(/tools/homework).
// 골드 값은 공식 공지 기준 정적 자료다. 화면 안에서 숫자가 서로 맞는지(관문 체크 → 요약 합)를 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

test.describe("레이드 보상표 @smoke", () => {
  test("레이드별 관문 보상 표와 공식 근거 링크가 있다", async ({ page }) => {
    await gotoReady(page, "/tools/raid-rewards");
    await expect(page.getByRole("heading", { level: 1, name: "레이드 보상표" })).toBeVisible();
    await expect(page.getByRole("table", { name: /관문별 보상/ }).first()).toBeVisible();
    // 근거는 공식 공지·가이드 링크(날짜 포함)로 남는다.
    // 사용자 결정 10-12: 화면에 출처·확인일을 쓰지 않는다(데이터 파일에만 남김).
    await expect(page.getByText(/출처|확인 \d{4}-\d{2}-\d{2}|공식 출처를 아직/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("분류 버튼으로 레이드를 거른다", async ({ page }) => {
    await gotoReady(page, "/tools/raid-rewards");
    const epic = page.getByRole("button", { name: "에픽 레이드" });
    await epic.click();
    await expect(epic).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "폭풍의 지휘관, 베히모스" })).toBeVisible();
    await expect(page.getByRole("region", { name: /^서막/ })).toHaveCount(0);
  });
});

test.describe("숙제 체크 @smoke", () => {
  test("원정대를 불러와 관문을 체크하면 이번 주 골드가 더해지고 새로고침해도 남는다", async ({ page }) => {
    await gotoReady(page, "/tools/homework");
    const summary = page.getByRole("region", { name: "이번 주 요약" });
    await expect(summary).toContainText("0G / 0G");

    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("상세");
    await page.getByRole("button", { name: "불러오기" }).click();
    await expect(page.getByRole("checkbox", { name: /^상세 블래스터/ })).toBeChecked();
    await page.getByRole("button", { name: /^\d+명 추가$/ }).click();

    const card = page.getByRole("region", { name: "상세 숙제" });
    await expect(card.getByRole("heading", { name: "상세" })).toBeVisible();
    // 요약의 목표 골드 = 캐릭터별 "골드 받기 0G / nG" 합
    const goals = await page.getByRole("switch", { name: /^골드 받기/ }).evaluateAll((els) =>
      els.map((el) => Number((el.getAttribute("aria-label") ?? [...(el.labels ?? [])].map((l) => l.textContent).join(" ")).match(/\/ ([\d,]+)G/)?.[1].replace(/,/g, "") ?? 0)),
    );
    expect(goals.every((g) => g > 0), "캐릭터별 목표 골드를 읽지 못함").toBe(true);
    const total = goals.reduce((a, b) => a + b, 0).toLocaleString("ko-KR");
    await expect(summary).toContainText(`0G / ${total}G`);

    // 첫 레이드 1관문 체크 → 그 관문 골드만큼 더해진다.
    const first = card.getByRole("group").first().getByRole("checkbox", { name: /^1관문/ });
    const gold = (await first.getAttribute("aria-label") ?? (await first.locator("..").innerText())).match(/([\d,]+)G/)?.[1];
    await first.check();
    await expect(summary).toContainText(`${gold}G / ${total}G`);

    await page.reload();
    await expect(page.getByRole("region", { name: "이번 주 요약" })).toContainText(`${gold}G / ${total}G`);
    await expectNoHorizontalOverflow(page);
  });

  test("레이드 순서를 키보드로 바꾸면 새로고침 뒤에도 남고, 전체 체크는 일부만이면 mixed다", async ({ page }) => {
    // 사용자 10-11 14:44: 순서 조절·전체 체크. 골드는 위에서부터 3개라 순서가 의미 있다.
    await gotoReady(page, "/tools/homework");
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("상세");
    await page.getByRole("button", { name: "불러오기" }).click();
    await page.getByRole("button", { name: /^\d+명 추가$/ }).click();
    const card = page.getByRole("region", { name: "상세 숙제" });
    const titles = () => card.locator("[class*=raidTitle]").allInnerTexts();
    const before = await titles();
    expect(before.length).toBeGreaterThan(1);

    // 첫 레이드의 '아래로' 버튼에 포커스를 두고 Alt+↓ → 두 번째로, 포커스는 그 버튼에 남는다.
    const down = card.getByRole("button", { name: `${before[0]} 아래로` });
    await down.focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect.poll(titles).toEqual([before[1], before[0], ...before.slice(2)]);
    await expect(down).toBeFocused();
    await expect(card.getByRole("status")).toContainText(`${before[0]}: 2번째로 옮겼어요.`);

    await page.reload();
    const reloaded = page.getByRole("region", { name: "상세 숙제" });
    await expect(reloaded.locator("[class*=raidTitle]")).toHaveText([before[1], before[0], ...before.slice(2)]);

    // 전체 체크: 관문 하나만 → 레이드·캐릭터 모두 mixed, 누르면 전부 / 다시 누르면 전부 해제.
    const all = reloaded.getByRole("checkbox", { name: "전체 완료" });
    await expect(all).not.toBeChecked();
    await reloaded.getByRole("group").first().getByRole("checkbox", { name: /^1관문/ }).check();
    await expect(all).toHaveAttribute("aria-checked", "mixed");
    const raidBox = reloaded.getByRole("checkbox", { name: before[1], exact: true });
    await expect(raidBox).toHaveAttribute("aria-checked", "mixed");
    await raidBox.click();
    await expect(raidBox).toBeChecked();
    await all.click();
    await expect(all).toBeChecked();
    await all.click();
    await expect(all).not.toBeChecked();
    await expectNoHorizontalOverflow(page);
  });

  test("순서 바꾸기에서 끌어 놓으면 레이드 순서가 바뀌고 남는다(bencho Reorder list)", async ({ page }) => {
    await gotoReady(page, "/tools/homework");
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("상세");
    await page.getByRole("button", { name: "불러오기" }).click();
    await page.getByRole("button", { name: /^\d+명 추가$/ }).click();
    const card = page.getByRole("region", { name: "상세 숙제" });
    const before = await card.locator("[class*=raidTitle]").allInnerTexts();
    await card.getByRole("button", { name: "순서 바꾸기" }).click();
    await expect(card.getByRole("button", { name: "완료" })).toHaveAttribute("aria-expanded", "true");

    await card.locator(".arr-row").first().scrollIntoViewIfNeeded();
    const box = await card.locator(".arr-row").first().boundingBox();
    await page.mouse.move(box.x + 60, box.y + box.height / 2);
    await page.mouse.down();
    // Real pointer pace (one move a frame), as a hand would.
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(box.x + 60, box.y + box.height / 2 + i * 5);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();

    const moved = [before[1], before[0], ...before.slice(2)];
    await expect.poll(() => card.locator("[class*=raidTitle]").allInnerTexts()).toEqual(moved);
    await page.reload();
    await expect(page.getByRole("region", { name: "상세 숙제" }).locator("[class*=raidTitle]")).toHaveText(moved);
  });

  const addRoster = async (page) => {
    await gotoReady(page, "/tools/homework");
    await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("상세");
    await page.getByRole("button", { name: "불러오기" }).click();
    await page.getByRole("button", { name: /^\d+명 추가$/ }).click();
    return page.getByRole("region", { name: "상세 숙제" });
  };

  test("순서 바꾸기 버튼은 '순서 바꾸기'↔'완료' 한 문구만, 폭이 그대로이고 초록 점 범례가 있다", async ({ page }) => {
    // 사용자 지적 10-11 21:00
    const card = await addRoster(page);
    const toggle = card.getByRole("button", { name: "순서 바꾸기" });
    const closed = await toggle.boundingBox();
    await toggle.click();
    const open = card.getByRole("button", { name: "완료" });
    await expect(open).toHaveAttribute("aria-expanded", "true");
    expect((await open.boundingBox()).width).toBe(closed.width);
    await expect(card.getByText(/주간 골드를 받는 레이드 — 위에서부터 캐릭터당 3개/)).toBeVisible();
    await open.click();
    await expect(card.getByRole("button", { name: "순서 바꾸기" })).toHaveAttribute("aria-expanded", "false");
  });

  test("순서 목록 줄을 키보드로 옮기면 포커스가 따라가고 알리며, 새로고침 뒤에도 남는다", async ({ page }) => {
    // 사용자 지적 10-11 21:02: Tab → 줄 → Alt+↓
    const card = await addRoster(page);
    const before = await card.locator("[class*=raidTitle]").allInnerTexts();
    await card.getByRole("button", { name: "순서 바꾸기" }).click();
    const list = card.getByRole("list", { name: "상세 레이드 순서" });
    await list.getByRole("listitem", { name: new RegExp(`^${before[0]}, 1번째`) }).focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(card.getByRole("status")).toContainText(`${before[0]}: 2번째로 옮겼어요.`);
    await expect(list.getByRole("listitem", { name: new RegExp(`^${before[0]}, 2번째`) })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(card.getByRole("status")).toContainText(`${before[0]}: 3번째로 옮겼어요.`);
    const moved = [before[1], before[2], before[0], ...before.slice(3)];
    await expect.poll(() => card.locator("[class*=raidTitle]").allInnerTexts()).toEqual(moved);
    await page.reload();
    await expect(page.getByRole("region", { name: "상세 숙제" }).locator("[class*=raidTitle]")).toHaveText(moved);
  });

  test("'선택'한 레이드는 ↑↓로 옮기고 Esc로 놓는다", async ({ page }) => {
    // 사용자 안 10-11 21:06
    const card = await addRoster(page);
    const before = await card.locator("[class*=raidTitle]").allInnerTexts();
    const select = card.getByRole("button", { name: `${before[0]} 선택` });
    await select.click();
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(card.getByRole("status")).toContainText(`${before[0]}: 3번째로 옮겼어요.`);
    const moved = [before[1], before[2], before[0], ...before.slice(3)];
    await expect.poll(() => card.locator("[class*=raidTitle]").allInnerTexts()).toEqual(moved);
    await expect(select).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(select).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => card.locator("[class*=raidTitle]").allInnerTexts()).toEqual(moved);
  });

  test("관문 줄의 체크박스는 모든 줄에서 같은 x에 있다", async ({ page }) => {
    // 사용자 지적 10-11 21:06: 더보기 금액 길이와 상관없이
    // 원정대 전체(더보기가 있는 레이드가 있는 카드 포함), 카드마다 따로 잰다.
    await addRoster(page);
    const cards = page.getByRole("region", { name: / 숙제$/ });
    await expect(page.locator("[class*=moreCheck] input").first()).toBeAttached();
    const xs = (selector) =>
      cards.locator(selector).evaluateAll((els) => [...new Set(els.map((el) => Math.round(el.getBoundingClientRect().left)))]);
    // 같은 너비의 카드 안에서는 x가 하나: 카드가 여러 열이면 열 수만큼.
    const columns = (await cards.evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().left))).size));
    expect((await xs("[class*=moreCheck] input")).length).toBeLessThanOrEqual(columns);
    expect((await xs("[class*=gateCheck] input")).length).toBeLessThanOrEqual(columns);
  });
});
