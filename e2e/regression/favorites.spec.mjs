// 회귀: 즐겨찾기·최근 검색은 이 브라우저에 저장된다(localStorage "loakraken:favorites"·"loakraken:recent").
// 새로고침·재접속(새 탭) 뒤에도 남고, 홈 "최근 검색과 즐겨찾기" 카드(web #114, 로아와식)에 보인다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const star = (page) => page.getByRole("button", { name: /^즐겨찾기( 해제)?$/ });
const card = (page) => page.getByRole("region", { name: "최근 검색과 즐겨찾기" });
// 기록은 화면이 수화(hydration)된 뒤 조회 성공 시 남는다. 제목은 서버 HTML로 먼저 보이므로 네트워크가 잠잠해질 때까지 기다린다.
async function visit(page, name) {
  await page.goto(characterPath(name));
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.waitForLoadState("networkidle");
}
const tab = (page, name) => card(page).getByRole("tablist", { name: "목록 선택" }).getByRole("tab", { name: new RegExp(`^${name}`) });

test.describe("즐겨찾기·최근 검색 저장 @regression", () => {
  test("즐겨찾기: 추가 → 새로고침 → 새 탭 홈 카드 → 해제", async ({ page, context }) => {
    await page.goto(characterPath("상세"));
    await expect(star(page)).toHaveAttribute("aria-pressed", "false");
    await star(page).click();
    await expect(page.getByRole("button", { name: "즐겨찾기 해제" })).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(page.getByRole("button", { name: "즐겨찾기 해제" })).toHaveAttribute("aria-pressed", "true");

    // 재접속: 같은 브라우저 저장소를 쓰는 새 탭
    const again = await context.newPage();
    await gotoReady(again, "/");
    await tab(again, "즐겨찾기").click();
    await expect(tab(again, "즐겨찾기")).toHaveAttribute("aria-selected", "true");
    await expect(tab(again, "즐겨찾기")).toContainText("1");
    const link = card(again).getByRole("link", { name: /상세/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(again).toHaveURL(new RegExp(`/character/${encodeURIComponent("상세")}`));

    await again.getByRole("button", { name: "즐겨찾기 해제" }).click();
    await expect(again.getByRole("button", { name: "즐겨찾기" })).toHaveAttribute("aria-pressed", "false");
    await gotoReady(again, "/");
    await tab(again, "즐겨찾기").click();
    await expect(card(again).getByRole("link", { name: /상세/ })).toHaveCount(0);
    await expect(card(again)).toContainText("캐릭터 화면의 별을 누르면 여기에 모여요.");
    await again.close();
  });

  test("최근 검색: 조회 성공만 기록 → 개별 삭제 → 전체 삭제", async ({ page }) => {
    await visit(page, "상세");
    await visit(page, "미존재"); // 실패한 조회는 기록하지 않는다
    await visit(page, "상세서포터");

    await gotoReady(page, "/");
    await expect(tab(page, "최근 검색")).toHaveAttribute("aria-selected", "true");
    const rows = card(page).getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("상세서포터"); // 최신 순
    await expect(card(page).getByRole("link", { name: /미존재/ })).toHaveCount(0);

    await card(page).getByRole("button", { name: "상세서포터 기록 삭제" }).click();
    await expect(rows).toHaveCount(1);
    await page.reload();
    await expect(card(page).getByRole("listitem")).toHaveCount(1);

    await card(page).getByRole("button", { name: "전체 삭제" }).click();
    await expect(card(page)).toContainText("검색한 캐릭터가 여기에 표시돼요.");
  });

  test("최근 검색: '검색어 저장'을 끄면 기록을 지우고 더 저장하지 않는다", async ({ page }) => {
    await visit(page, "상세");
    await gotoReady(page, "/");
    await expect(card(page).getByRole("listitem")).toHaveCount(1);

    await card(page).getByRole("checkbox", { name: "검색어 저장" }).uncheck();
    await expect(card(page)).toContainText("검색어 저장이 꺼져 있어요.");
    await visit(page, "상세서포터");
    await gotoReady(page, "/");
    await expect(card(page).getByRole("checkbox", { name: "검색어 저장" })).not.toBeChecked();
    await expect(card(page).getByRole("listitem")).toHaveCount(0);
  });

  test("저장소가 깨져 있어도 화면이 열린다", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("loakraken:favorites", "{not json");
      localStorage.setItem("loakraken:recent", "[1,{\"name\":2}]");
    });
    await gotoReady(page, "/");
    await expect(page.getByRole("textbox", { name: "캐릭터 이름" })).toBeVisible();
    await expect(card(page)).toContainText("검색한 캐릭터가 여기에 표시돼요.");
    await page.goto(characterPath("상세"));
    await expect(star(page)).toBeVisible();
  });
});
