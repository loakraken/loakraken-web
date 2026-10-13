// 홈 대시보드(web #58·#71·#82): 주간 일정표 요일 선택, 시각별 섹션 머리 문구, 점검 배너, 시세·공지.
// 홈 첫 HTML은 서버가 일정·공지를 미리 받아 그린다(#71). 그래서 응답을 가로채지 않고
// 브라우저 시계만 고정한다. 목 일정의 모험 섬은 매일 09·11·13·19·21·23시 정각이다.
import { test, expect, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";

const DAY = 86_400_000;
const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const kstAt = (hhmm, dayOffset = 0) => Date.parse(`${kstToday()}T${hhmm}:00+09:00`) + dayOffset * DAY;

test.describe("홈 대시보드 @smoke", () => {
  test("일정·시세·공지가 보이고 가로 스크롤이 없다", async ({ page }) => {
    await gotoReady(page, "/");
    await expect(page.getByRole("heading", { level: 1, name: "로스트아크 캐릭터 검색" })).toBeVisible();
    await expect(page.getByRole("region", { name: "주간 일정표" })).toBeVisible();
    await expect(page.getByRole("region", { name: "모험 섬" })).toBeVisible();
    await expect(page.getByRole("region", { name: "재련 재료 시세" }).getByRole("listitem").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "공지사항" }).getByRole("listitem").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("다른 요일을 누르면 그 날짜로 다시 조회한다", async ({ page }) => {
    await gotoReady(page, "/");
    const days = page.getByRole("group", { name: "요일 선택" });
    await expect(days.locator('[aria-pressed="true"]')).toHaveCount(1);
    const target = days.locator('button[aria-pressed="false"]').first();
    const label = await target.getAttribute("aria-label");
    const request = page.waitForRequest(/\/api\/home\/schedule\?date=\d{4}-\d{2}-\d{2}/);
    await target.click();
    await request;
    await expect(days.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
  });

  // 목 공지의 점검 날짜는 서버 기준 오늘이다. 브라우저 날짜를 옮겨 오늘·내일·그 외를 만든다.
  const BANNER = [
    [0, /^오늘 점검/, "점검일 당일에는 '오늘 점검' 배너"],
    [-1, /^내일 점검/, "점검 전날에는 '내일 점검' 배너"],
    [2, null, "점검일이 지나면 배너를 숨긴다"],
  ];
  for (const [offset, banner, meaning] of BANNER) {
    test(meaning, async ({ page }) => {
      await page.clock.setFixedTime(kstAt("12:00", offset));
      await gotoReady(page, "/");
      await expect(page.getByRole("region", { name: "공지사항" }).getByRole("listitem").first()).toBeVisible();
      const link = page.getByRole("link", { name: /^(오늘|내일) 점검/ });
      if (banner) await expect(link).toHaveAccessibleName(banner);
      else await expect(link).toHaveCount(0);
    });
  }
});

test.describe("홈 일정 시각 상태 @regression", () => {
  test("08:00 — 오늘 첫 회차까지 남은 시간", async ({ page }) => {
    await page.clock.setFixedTime(kstAt("08:00"));
    await gotoReady(page, "/");
    const header = page.getByRole("region", { name: "모험 섬" }).locator("header");
    await expect(header).toContainText(/09:00 · 1시간 0분/);
    await expect(header).not.toContainText("남음");
  });

  test("13:30 — 다음 회차, 지난 회차 시각은 숨김", async ({ page }) => {
    await page.clock.setFixedTime(kstAt("13:30"));
    await gotoReady(page, "/");
    const islands = page.getByRole("region", { name: "모험 섬" });
    await expect(islands.locator("header")).toContainText(/19:00 · 5시간 30분/);
    await expect(page.getByRole("button", { name: "지난 회차 숨김" })).toHaveAttribute("aria-pressed", "true");
    // 숨김이 켜져 있으면 지난 시각(09·11·13시)은 자리만 두고 보이지 않으며(A7: 남은 시각이 움직이지 않게), 남은 시각만 보인다.
    await expect(islands.locator("time[data-past]:not([data-hidden])")).toHaveCount(0);
    await expect(islands.locator("time", { hasText: "19:00" }).first()).toBeVisible();
    await expect(islands.locator("time", { hasText: "09:00" }).first()).toBeHidden();
  });

  test("23:30 — 오늘 일정 종료와 내일 일정 보기", async ({ page }) => {
    await page.clock.setFixedTime(kstAt("23:30"));
    await gotoReady(page, "/");
    const islands = page.getByRole("region", { name: "모험 섬" });
    await expect(islands.locator("header")).toContainText("오늘 일정 종료");
    const tomorrow = islands.getByRole("button", { name: "내일 일정 보기" });
    // 주간 범위의 마지막 날(화요일)에는 내일이 범위 밖이라 버튼이 없다.
    if (await tomorrow.count()) {
      await tomorrow.click();
      const pressed = page.getByRole("group", { name: "요일 선택" }).locator('[aria-pressed="true"]');
      const tomorrowDay = Number(new Date(kstAt("12:00", 1) + 9 * 3_600_000).toISOString().slice(8, 10));
      await expect(pressed).toHaveAccessibleName(new RegExp(`^${tomorrowDay}일`));
    }
  });

  test("23:30 — 지난 회차 숨김을 끄면 지난 회차가 취소선으로 다시 보인다", async ({ page }) => {
    await page.clock.setFixedTime(kstAt("23:30"));
    await gotoReady(page, "/");
    const islands = page.getByRole("region", { name: "모험 섬" });
    await expect(islands.locator("header")).toContainText("오늘 일정 종료");
    // 숨김 켬(기본): 오늘 회차가 모두 지난 행은 숨겨진다.
    const hide = page.getByRole("button", { name: "지난 회차 숨김" });
    await expect(hide).toHaveAttribute("aria-pressed", "true");
    await expect(islands.getByRole("listitem")).toHaveCount(0);
    // 숨김 끔: 행과 지난 시각이 다시 보이고, 지난 시각은 취소선이다.
    await hide.click();
    await expect(hide).toHaveAttribute("aria-pressed", "false");
    await expect(islands.getByRole("listitem").first()).toBeVisible();
    const past = islands.locator("time[data-past]");
    expect(await past.count()).toBeGreaterThan(0);
    await expect(past.first()).toHaveCSS("text-decoration-line", "line-through");
  });
});
