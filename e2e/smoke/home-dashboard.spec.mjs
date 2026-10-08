// 홈 대시보드(web #58): 주간 일정표 요일 선택, 시각별 다음 회차 안내, 오늘 점검 배너, 시세 요약.
// 프론트 요청(2026-10-08). 시계 테스트는 브라우저 시계를 고정하고, 백엔드가 그 시각에 줄
// nextAt만 같은 규칙(다음 시작 시각, 없으면 다음 날 첫 회차)으로 다시 계산해 돌려준다.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const DAY = 86_400_000;
const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const kstAt = (hhmm) => Date.parse(`${kstToday()}T${hhmm}:00+09:00`);

async function scheduleAt(page, now) {
  await page.clock.setFixedTime(now);
  await page.route("**/api/home/schedule**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const data = body.envelope?.data;
    if (data)
      for (const key of ["adventureIslands", "fieldBosses", "chaosGates", "others"])
        for (const item of data[key]) {
          const later = item.startTimes.find((at) => Date.parse(at) > now);
          item.nextAt =
            later ?? (item.startTimes.length ? new Date(Date.parse(item.startTimes[0]) + DAY).toISOString() : null);
        }
    await route.fulfill({ response, json: body });
  });
}

test.describe("홈 대시보드 @smoke", () => {
  test("일정·시세·공지가 보이고 가로 스크롤이 없다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "로스트아크 캐릭터 검색" })).toBeVisible();
    await expect(page.getByRole("region", { name: "주간 일정표" })).toBeVisible();
    await expect(page.getByRole("region", { name: "모험 섬" })).toBeVisible();
    await expect(page.getByRole("region", { name: "재련 재료 시세" }).getByRole("listitem").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "공지사항" }).getByRole("listitem").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("다른 요일을 누르면 그 날짜로 다시 조회한다", async ({ page }) => {
    await page.goto("/");
    const days = page.getByRole("group", { name: "요일 선택" });
    await expect(days.locator('[aria-pressed="true"]')).toHaveCount(1);
    const target = days.locator('button[aria-pressed="false"]').first();
    const label = await target.getAttribute("aria-label");
    const request = page.waitForRequest(/\/api\/home\/schedule\?date=\d{4}-\d{2}-\d{2}/);
    await target.click();
    await request;
    await expect(days.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
  });

  test("오늘 점검 공지가 있으면 배너를 보여 준다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^오늘 점검/ })).toBeVisible();
  });

  test("점검 날짜가 오늘이 아니면 배너를 숨긴다", async ({ page }) => {
    await page.route("**/api/home/news**", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const yesterday = new Date(Date.now() + 9 * 3_600_000 - DAY).toISOString().slice(0, 10);
      for (const notice of body.envelope?.data.notices ?? [])
        if (notice.maintenanceDate) notice.maintenanceDate = yesterday;
      await route.fulfill({ response, json: body });
    });
    await page.goto("/");
    await expect(page.getByRole("region", { name: "공지사항" }).getByRole("listitem").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^오늘 점검/ })).toHaveCount(0);
  });
});

test.describe("홈 일정 시각 상태 @regression", () => {
  const CASES = [
    ["08:00", /09:00 · 1시간 0분/, "첫 회차 전에는 오늘 첫 회차까지 남은 시간"],
    ["13:30", /19:00 · 5시간 30분/, "회차 사이에는 다음 회차"],
    ["23:30", /오늘 일정 종료 · 내일 09:00 · 9시간 30분 후/, "마지막 회차 뒤에는 오늘 종료와 내일 첫 회차"],
  ];
  for (const [time, expected, meaning] of CASES) {
    test(`${time} — ${meaning}`, async ({ page }) => {
      await scheduleAt(page, kstAt(time));
      await page.goto("/");
      const islands = page.getByRole("region", { name: "모험 섬" });
      await expect(islands.getByRole("heading", { name: "모험 섬" })).toBeVisible();
      await expect(islands.locator("header")).toContainText(expected);
    });
  }
});
