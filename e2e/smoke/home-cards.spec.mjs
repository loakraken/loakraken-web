// 홈 카드: 인기 검색 캐릭터(web #129, F-10)와 공지/패치노트 탭(web #121).
// 목 표본: 인기 24시간은 READY 4명(1위 인기F), 7일은 COLLECTING(집계 중).
// 공지 분류(lib/home/model.ts isPatchNote): 점검이 아니고 제목에 "업데이트 내역·패치 안내·패치노트"가 있으면 패치노트.
import { test, expect, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";

test.describe("홈 인기 검색 캐릭터 @smoke", () => {
  test("24시간 순위를 보여 주고 캐릭터로 이동한다", async ({ page }) => {
    await gotoReady(page, "/");
    const card = page.getByRole("region", { name: "인기 검색 캐릭터" });
    const periods = card.getByRole("group", { name: "기간" });
    await expect(periods.getByRole("button", { name: "24시간" })).toHaveAttribute("aria-pressed", "true");
    const rows = card.getByRole("listitem");
    await expect(rows).toHaveCount(4);
    // 순위 칸은 링크의 첫 칸(b)이다. 아이템 레벨 숫자와 섞이지 않게 칸을 짚는다.
    for (const [i, row] of (await rows.all()).entries())
      await expect(row.getByRole("link").locator("b").first()).toHaveText(String(i + 1));
    await expect(rows.first()).toContainText("인기F");
    // F-10 결정: 조회 수는 보여 주지 않는다.
    await expect(card.getByRole("list")).not.toContainText(/조회|\d+회/);
    await expect(card).toContainText("같은 사람의 반복 검색은 하루 한 번만 셉니다.");
    await rows.first().getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/character/${encodeURIComponent("인기F")}$`));
  });

  test("7일로 바꾸면 다시 조회하고, 집계 중이면 안내한다", async ({ page }) => {
    await gotoReady(page, "/");
    const card = page.getByRole("region", { name: "인기 검색 캐릭터" });
    await expect(card.getByRole("listitem").first()).toBeVisible();
    const request = page.waitForRequest(/\/api\/characters\/popular\?.*period=7d/);
    await card.getByRole("group", { name: "기간" }).getByRole("button", { name: "7일" }).click();
    await request;
    await expect(card.getByRole("button", { name: "7일" })).toHaveAttribute("aria-pressed", "true");
    await expect(card).toContainText("아직 순위를 집계하고 있어요.");
    await expect(card.getByRole("listitem")).toHaveCount(0);
  });

  test("순위 요청이 실패하면 실패를 안내한다", async ({ page }) => {
    // 24시간 순위는 서버가 첫 HTML에 넣으므로(web #236) 브라우저가 부르는 7일 전환을 실패시킨다.
    await page.route(/\/api\/characters\/popular\?.*period=7d/, (route) =>
      route.fulfill({ status: 502, json: { ok: false, error: { code: "LOST_ARK_API_ERROR", status: 502 } } }),
    );
    await gotoReady(page, "/");
    const card = page.getByRole("region", { name: "인기 검색 캐릭터" });
    await expect(card.getByRole("listitem").first()).toBeVisible();
    await card.getByRole("group", { name: "기간" }).getByRole("button", { name: "7일" }).click();
    await expect(card).toContainText("순위를 불러오지 못했어요.");
  });
});

test.describe("홈 공지·패치노트 @smoke", () => {
  test("공지와 패치노트를 나눠 보여 준다", async ({ page }) => {
    await gotoReady(page, "/");
    const card = page.getByRole("region", { name: "공지사항" });
    const kinds = card.getByRole("tablist", { name: "공지 종류" });
    await expect(kinds.getByRole("tab", { name: "공지", exact: true })).toHaveAttribute("aria-selected", "true");
    // The shown list only: the other tab's list stays in the card, hidden (A7).
    const shown = card.getByRole("list");
    // 점검 공지는 패치노트처럼 보여도 공지 쪽이다.
    await expect(shown).toContainText("임시 점검 안내");
    await expect(shown).not.toContainText("업데이트 내역 안내");
    await expect(shown).not.toContainText("클라이언트 패치 안내");

    await kinds.getByRole("tab", { name: "패치노트" }).click();
    await expect(kinds.getByRole("tab", { name: "패치노트" })).toHaveAttribute("aria-selected", "true");
    await expect(card.getByRole("link", { name: /전체 보기/ })).toHaveAttribute("href", "/news?tab=patch");
    await expect(shown).toContainText("업데이트 내역 안내");
    await expect(shown).toContainText("클라이언트 패치 안내");
    await expect(shown).not.toContainText("임시 점검 안내");
  });
});

test.describe("홈 바로 가기 @smoke", () => {
  test("자주 쓰는 화면으로 바로 간다", async ({ page }) => {
    await gotoReady(page, "/");
    const quick = page.getByRole("navigation", { name: "바로 가기" });
    await expect(quick.getByRole("link")).toHaveCount(10);
    await expect(quick.getByRole("link", { name: "멀티서치" })).toHaveAttribute("href", "/multi-search");
    await expect(quick.getByRole("link", { name: "숙제 체크" })).toHaveAttribute("href", "/tools/homework");
    await quick.getByRole("link", { name: "거래소 시세" }).click();
    await expect(page).toHaveURL(/\/market$/);
    await expect(page.getByRole("heading", { level: 1, name: "시세" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
