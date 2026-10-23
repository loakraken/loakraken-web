// 회귀(사용자 결정 10-18): 소식 탭 'LOAKraken 개발자 노트' — 저장소 마크다운 글(e2e는 support/dev-notes)의
// 목록(최신순, 날짜·제목·요약)과 글 화면(표·목록·굵게·링크). 탭 전환 흔들림 0, 360에서 탭 이름이 잘리지 않고
// 패널 안, 글의 HTML·위험한 주소는 글자 그대로, 없는 글은 404, 사이트맵에 글 주소.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const NEWEST = "테스트 릴리스 노트: 원정대 랭킹과 시세 차트";

for (const width of [1280, 360])
  test(`@개발자노트 ${width} 탭·목록·글 화면, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/news");
    const kinds = page.getByRole("group", { name: "공지 종류" });
    const tab = kinds.getByRole("button", { name: "LOAKraken 개발자 노트" });
    // The name in full, inside the panel: folded onto lines on a phone, never cut (A37).
    const fit = await tab.evaluate((el) => {
      const panel = el.closest("section").getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return { inside: box.left >= panel.left && box.right <= panel.right, cut: el.scrollWidth > el.clientWidth + 1 };
    });
    expect(fit, "탭 이름이 패널 안, 잘리지 않음").toEqual({ inside: true, cut: false });

    const moved = await shiftsDuring(page, () => tab.click(), 800);
    expect(moved.all, `개발자 노트 탭 전환 흔들림 (${moved.moved})`).toBe(0);
    await expect(page).toHaveURL(/\/news\?tab=dev$/);
    await expect(page.getByRole("heading", { level: 2, name: "LOAKraken 개발자 노트" })).toBeVisible();
    const items = page.getByRole("list", { name: "LOAKraken 개발자 노트 목록" }).getByRole("listitem");
    // The pinned note first (marked 고정, older than the rest), then newest first;
    // the README in the folder is not a note.
    await expect(items).toHaveCount(3);
    // The tag itself (the test title has the word 고정 in it too).
    await expect(items.nth(0)).toContainText("테스트 고정 글: 준비 중인 기능");
    await expect(items.nth(0)).toContainText("2026.10.05");
    await expect(items.nth(1)).toContainText("2026.10.19");
    await expect(items.nth(1)).toContainText(NEWEST);
    await expect(items.nth(1).locator("strong > em")).toHaveCount(0);
    await expect(items.nth(1)).toContainText("원정대 랭킹 식스맨 규칙을 바꾸고 시세 차트에 기간 등락을 더했어요.");
    await expect(items.nth(2)).toContainText("2026.10.12"); // from the file name
    await expect(items.nth(2)).toContainText("테스트 지난 노트");
    const back = await shiftsDuring(page, () => kinds.getByRole("button", { name: "공지사항" }).click(), 800);
    expect(back.all, `공지사항으로 돌아갈 때 흔들림 (${back.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);

    // The note page.
    await gotoReady(page, "/news?tab=dev");
    await page.getByRole("link", { name: new RegExp(NEWEST) }).click();
    await expect(page).toHaveURL(/\/news\/dev-notes\/2026-10-19-test-release$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(NEWEST);
    await expect(page.locator("article time")).toHaveText("2026.10.19");
    const article = page.locator("article");
    // "#" and "##" are sections under the page's one h1, "###" under them.
    await expect(article.getByRole("heading", { level: 2 })).toHaveText(["바뀐 것", "원정대 랭킹"]);
    await expect(article.getByRole("heading", { level: 3 })).toHaveText("숫자로 보면");
    await expect(article.getByText("이번 판에서는 원정대 랭킹과 시세 화면이 바뀌었어요. 같은 문단의 둘째 줄이에요.")).toBeVisible();
    await expect(article.locator("strong")).toHaveText("아이템 레벨 상위 6명");
    await expect(article.getByRole("table").getByRole("columnheader")).toHaveText(["항목", "예전", "지금"]);
    await expect(article.getByRole("table").getByRole("row")).toHaveCount(3);
    await expect(article.locator("ol li")).toHaveText(["첫째 단계", "둘째 단계"]);
    await expect(article.locator("blockquote")).toHaveText("유저 의견을 받아 고쳤어요.");
    await expect(article.getByRole("link", { name: "원정대 랭킹" })).toHaveAttribute("href", "/rankings?type=roster");
    // Said to open beside the page, for a screen reader too.
    const outside = article.getByRole("link", { name: "공식 홈페이지 (새 창)" });
    await expect(outside).toHaveAttribute("target", "_blank");
    // A javascript: address and an HTML tag stay text: no link, no element.
    await expect(article.getByRole("link", { name: "링크가 아니에요" })).toHaveCount(0);
    await expect(article).toContainText("[링크가 아니에요](javascript:alert(1))");
    await expect(article).toContainText("<script>alert(1)</script>");
    expect(await article.locator("script").count()).toBe(0);
    await expectNoHorizontalOverflow(page);
    // Back to the list.
    await page.getByRole("link", { name: "개발자 노트 목록" }).click();
    await expect(page).toHaveURL(/\/news\?tab=dev$/);
  });

test("@개발자노트 글 메타·canonical, 없는 글 404, 사이트맵 @regression", async ({ page, request }) => {
  await gotoReady(page, "/news/dev-notes/2026-10-19-test-release");
  await expect(page).toHaveTitle(`${NEWEST} · 개발자 노트 | LOAKraken`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "원정대 랭킹 식스맨 규칙을 바꾸고 시세 차트에 기간 등락을 더했어요.",
  );
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(new URL(canonical).pathname).toBe("/news/dev-notes/2026-10-19-test-release");

  for (const missing of ["/news/dev-notes/2026-10-19-nope", "/news/dev-notes/README", "/news/dev-notes/..%2F..%2Fpackage"])
    expect((await request.get(missing)).status(), missing).toBe(404);

  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("/news/dev-notes/2026-10-19-test-release</loc>");
  expect(xml).toContain("/news/dev-notes/2026-10-12-older-note</loc>");
  expect(xml).not.toContain("README");
});
