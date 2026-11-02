// 스펙업 추천 순서 (api #794): the first chip of the spec-up list since 11-02 (사용자
// 결정 layout A) and a dealer's first view, asked for while chosen. Its rows are
// the list's rows (image, detail, a target's later steps under 자세히). The mock
// serves the backend's sample (보석 8→9→10 on one slot, 품질 unpriced); '스펙순서긴'
// has 14 steps (13 rows), '스펙순서몰림' is SPEC_UP_BUSY, '스펙순서스톤' adds a stone step.
import { test, expect, characterPath, expectNoHorizontalOverflow, specUpListPath } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const chips = (page) => page.getByRole("group", { name: "정렬" });
const rule = (page) => page.getByRole("group", { name: "추천 순서 고르는 기준" });
const pathTable = (page) => page.getByRole("table", { name: /^추천 순서, / });
const rows = (page) => pathTable(page).locator("tbody tr:not([data-collapsed])");

test.describe("스펙업 추천 순서 @smoke", () => {
  test("탭을 열면 추천 순서가 먼저: 저절로 묻고, 같은 보석 칸의 다음 단계는 자세히에, 단계 비용은 그 단계에서 더 드는 골드", async ({ page }) => {
    const asked = page.waitForRequest((r) => r.url().includes("/api/characters/spec-up/path?"));
    await page.goto(characterPath("스펙순서", "specup"));
    expect(new URL((await asked).url()).searchParams.get("sort")).toBe("EFFICIENCY");
    await expect(chips(page).getByRole("button").first()).toHaveText("추천 순서");
    await expect(chips(page).getByRole("button", { name: "추천 순서" })).toHaveAttribute("aria-pressed", "true");
    await expect(rule(page).getByRole("button", { name: "효율 우선" })).toHaveAttribute("aria-pressed", "true");
    await expect(pathTable(page)).toBeVisible();
    // 보석 8→9 and 9→10 on one slot: one row, the next stage behind 자세히.
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("8레벨 → 9레벨");
    await expect(rows(page).first()).toContainText("+60만G");
    await rows(page).first().getByRole("button", { name: "자세히 · 다른 단계 1개" }).click();
    await expect(rows(page)).toHaveCount(2);
    // 9→10 costs 260만G from today's gem; this step adds 200만G on top of step 1.
    await expect(rows(page).nth(1)).toContainText("+200만G");
    await expect(rows(page).nth(1)).toContainText("누적 260만G");
    await expect(page.getByText(/합계 260만G/)).toBeVisible();
    // NO_CANDIDATE reads the backend's sentence.
    await expect(page.getByText("시세가 있는 항목 가운데 전투력이 오르는 것을 모두 골랐어요.")).toBeVisible();
    await expect(page.getByText("시세를 몰라 순서에서 뺀 항목 1개")).toBeVisible();
    await expect(page.getByRole("link", { name: "이 순서를 시뮬레이터에서 열기" })).toHaveAttribute("href", /tab=simulator/);
    // The first view is the default: nothing added to the address.
    expect(new URL(page.url()).searchParams.get("sort")).toBeNull();
  });

  test("줄의 대상을 누르면 후보 목록과 같은 자세히(이미지 · 시세)가 열림", async ({ page }) => {
    await page.goto(characterPath("스펙순서", "specup"));
    const target = rows(page).first().getByRole("button").first();
    await expect(target).toBeVisible();
    await target.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("다른 칩은 후보 목록, 고른 칩은 주소에(새로 고쳐도 그대로), 돌아오면 다시 묻지 않음", async ({ page }) => {
    let paths = 0;
    page.on("request", (r) => r.url().includes("/api/characters/spec-up/path?") && paths++);
    await page.goto(characterPath("스펙순서", "specup"));
    await expect(pathTable(page)).toBeVisible();
    await chips(page).getByRole("button", { name: "전투력 증가" }).click();
    await expect(page.getByRole("table", { name: /스펙업 후보, 전투력 증가 순/ })).toBeVisible();
    await expect(pathTable(page)).toHaveCount(0);
    // The rule buttons stay in their slot, hidden: the bar keeps its size (A7).
    await expect(rule(page).getByRole("button", { name: "효율 우선" })).toBeHidden();
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("DELTA");
    await page.reload();
    await expect(chips(page).getByRole("button", { name: "전투력 증가" })).toHaveAttribute("aria-pressed", "true");
    await chips(page).getByRole("button", { name: "추천 순서" }).click();
    await expect(pathTable(page)).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBeNull();
    expect(paths).toBe(1);
  });

  test("기준을 바꾸면 그 기준으로 다시 묻고, 새 답이 올 때까지 앞 순서가 남음(흔들림 0)", async ({ page }) => {
    await watchShifts(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(characterPath("스펙순서", "specup"));
    await expect(rows(page)).toHaveCount(1);
    const asked = page.waitForRequest((r) => r.url().includes("sort=DELTA"));
    const shifts = await shiftsDuring(page, async () => {
      await rule(page).getByRole("button", { name: "전투력 우선" }).click();
      await asked;
    });
    await expect(rule(page).getByRole("button", { name: "전투력 우선" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("table", { name: "추천 순서, 전투력 우선 기준" })).toBeVisible();
    expect(shifts.all, shifts.moved).toBe(0);
  });

  for (const width of [320, 1280])
    test(`${width}: 계산하는 동안 같은 높이의 빈 줄로 자리를 잡아, 답이 늦게 와도 아래가 움직이지 않음`, async ({ page }) => {
      await watchShifts(page);
      await page.setViewportSize({ width, height: 900 });
      // A cold cache answers late (QA 11-01: ~5 s, CLS 0.293 at 320); 800 ms here (#1135).
      let release;
      const held = new Promise((resolve) => (release = resolve));
      await page.route("**/api/characters/spec-up/path?*", async (route) => {
        await held;
        await route.continue();
      });
      await page.goto(characterPath("스펙순서", "specup"));
      await expect(page.getByText("추천 순서를 계산하고 있어요…")).toBeVisible();
      await expect(page.getByRole("heading", { name: "목표 전투력" })).toBeVisible();
      const shifts = await shiftsDuring(page, async () => {
        setTimeout(release, 800);
        await expect(pathTable(page)).toBeVisible();
      });
      expect(shifts.all, shifts.moved).toBe(0);
      await expectNoHorizontalOverflow(page);
    });

  test("10줄 넘게는 접어 두고 '모두 보기'로 펼침, 320·360에서 가로 넘침 없음", async ({ page }) => {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(characterPath("스펙순서긴", "specup"));
      await expect(rows(page)).toHaveCount(10);
      await expect(page.getByText("앞에서부터 14단계까지 보여 드려요.")).toBeVisible();
      const more = page.getByRole("button", { name: "13줄 모두 보기" });
      await more.click();
      await expect(rows(page)).toHaveCount(13);
      await expect(page.getByRole("button", { name: "앞 10줄만 보기" })).toHaveAttribute("aria-expanded", "true");
      await expectNoHorizontalOverflow(page);
    }
  });

  test("계산 자리가 차면(SPEC_UP_BUSY) 안내와 남은 초, 그동안 다시 누를 수 없음", async ({ page }) => {
    await page.goto(characterPath("스펙순서몰림", "specup"));
    await expect(page.getByRole("alert")).toContainText("요청이 몰려 지금은 계산하지 못했어요");
    const again = page.getByRole("button", { name: /뒤 다시 계산$/ });
    await expect(again).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "다시 계산" })).toBeVisible({ timeout: 10_000 });
  });

  test("후보가 모두 시세를 몰라 단계가 없으면 그 이유를 말하고, 뺀 항목을 펼칠 수 있음", async ({ page }) => {
    await page.goto(characterPath("스펙순서시세없음", "specup"));
    await expect(page.getByText("올릴 수 있는 항목 3개 모두 시세를 몰라 순서를 만들 수 없어요.", { exact: false })).toBeVisible();
    // The backend's "all picked" sentence would read as a finished list.
    await expect(page.getByText(/모두 골랐어요/)).toHaveCount(0);
    await expect(page.getByText("시세를 몰라 순서에서 뺀 항목 3개")).toBeVisible();
  });

  for (const width of [320, 360, 390, 600, 680, 768])
    test(`스톤 단계(각인 두 개)의 긴 바꿈 글자도 ${width}에서 잘리거나 넘치지 않음`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(characterPath("스펙순서스톤", "specup"));
      const stone = rows(page).filter({ hasText: "어빌리티 스톤" });
      await expect(stone).toContainText("원한 Lv.1 · 아드레날린 Lv.1 → 97돌 원한 Lv.3 · 아드레날린 Lv.2");
      const cut = await stone.evaluate((tr) =>
        [...tr.children].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.trim()),
      );
      expect(cut, "잘린 칸").toEqual([]);
      await expectNoHorizontalOverflow(page);
    });

  test("서포터는 추천 순서 칩이 없고 서포터 점수 목록", async ({ page }) => {
    await page.goto(characterPath("상세서포터", "specup"));
    await expect(page.getByRole("table", { name: "스펙업 후보, 서포터 점수 순" })).toBeVisible();
    await expect(chips(page).getByRole("button", { name: "추천 순서" })).toHaveCount(0);
    await expect(pathTable(page)).toHaveCount(0);
  });

  test("후보 목록 주소(sort=DELTA)로 열면 추천 순서를 묻지 않음", async ({ page }) => {
    let paths = 0;
    page.on("request", (r) => r.url().includes("/api/characters/spec-up/path?") && paths++);
    await page.goto(specUpListPath("스펙순서"));
    await expect(page.getByRole("table", { name: /스펙업 후보, 전투력 증가 순/ })).toBeVisible();
    expect(paths).toBe(0);
  });
});
