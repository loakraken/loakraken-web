// 회귀(A36): 휴대폰 폭에서 작은 버튼도 누르는 영역은 44×44. 버튼 가운데에서 가로·세로 21px
// 떨어진 네 모서리를 elementFromPoint로 짚어 모두 그 버튼(또는 감싼 label)이 잡혀야 한다.
// 옆·위아래 버튼이 잡히면 영역이 겹친 것. 보이는 크기는 그대로다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });

/** What the four corners of the 44×44 square around the control land on, when not on it. */
async function misses(locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
  return locator.evaluate((el) => {
    const owner = el.closest("label") ?? el;
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const out = [];
    for (const [x, y] of [[cx - 21, cy - 21], [cx + 21, cy - 21], [cx - 21, cy + 21], [cx + 21, cy + 21]]) {
      const hit = document.elementFromPoint(x, y);
      if (hit && owner.contains(hit)) continue;
      const other = hit?.closest("button, a[href], [role=switch], summary");
      out.push(other ? `이웃 ${(other.getAttribute("aria-label") ?? other.textContent ?? "").trim().slice(0, 12)}` : "빈 곳");
    }
    return out;
  });
}

async function expectPressable(locators) {
  for (const [name, locator] of locators) {
    await expect(locator, name).toBeVisible();
    expect(await misses(locator), `${name}: 44×44 네 모서리`).toEqual([]);
  }
}

test("캐릭터 화면 작은 버튼 누르는 영역 44 @regression @A36", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  await expectPressable([
    ["더보기", page.getByRole("button", { name: "더보기" })],
    ["딜러", page.getByRole("group", { name: "세트 종류" }).getByRole("button", { name: "딜러" })],
    ["서포터", page.getByRole("group", { name: "세트 종류" }).getByRole("button", { name: "서포터" })],
  ]);

  await gotoReady(page, characterPath("상세", "collectibles"));
  const owned = page.getByRole("group", { name: "획득 상태" });
  await expectPressable(
    ["전체", "미획득", "획득", "희귀한 순"].map((name) => [name, owned.getByRole("button", { name: new RegExp(`^${name}`) })]),
  );

  await gotoReady(page, characterPath("상세", "skills"));
  const gems = page.getByRole("group", { name: "보석으로 거르기" });
  await expectPressable(
    ["전체", "둘 다", "겁화만", "작열만", "미장착"].map((name) => [name, gems.getByRole("button", { name: new RegExp(`^${name}`) })]),
  );

  await gotoReady(page, characterPath("상세", "specup"));
  const sorts = page.getByRole("group", { name: "정렬" });
  await expectPressable([
    ["1만 골드당 효율", sorts.getByRole("button", { name: "1만 골드당 효율" })],
    ["전투력 증가", sorts.getByRole("button", { name: "전투력 증가" })],
  ]);

  await gotoReady(page, characterPath("상세", "siblings"));
  await expectPressable([
    ["축약", page.getByRole("switch", { name: "축약" })],
    ["닉네임 가리기", page.getByRole("switch", { name: "닉네임 가리기" })],
  ]);
});

test("홈 인기 검색 기간·소식 분류 누르는 영역 44 @regression @A36", async ({ page }) => {
  await gotoReady(page, "/");
  const period = page.getByRole("group", { name: "기간", exact: true });
  await expectPressable([
    ["24시간", period.getByRole("button", { name: "24시간" })],
    ["7일", period.getByRole("button", { name: "7일" })],
  ]);

  await gotoReady(page, "/news");
  const kinds = page.getByRole("group", { name: "공지 종류" });
  await expectPressable([
    ["공지사항", kinds.getByRole("button", { name: "공지사항" })],
    ["패치 이력", kinds.getByRole("button", { name: "패치 이력" })],
  ]);
});
