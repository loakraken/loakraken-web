// 캐릭터 화면: 8개 탭, 탭 이동·새로고침 유지, 오류 응답(404·429·502·503·504).
// 목 캐릭터 '상세'는 장비 Tooltip·스킬·내실·아바타·아크 그리드까지 채운 합성 데이터다.
import {
  test,
  expect,
  characterPath,
  expectNoHorizontalOverflow,
  CONTRACT_FAILURE,
} from "../support/fixtures.mjs";

const TABS = [
  { id: "combat", label: "전투", headings: ["장비", "보석", "아크 그리드", "카드", "아크 패시브", "특성", "각인", "스킬"] },
  { id: "skills", label: "스킬", headings: ["스킬"] },
  { id: "arkpassive", label: "아크 패시브", headings: ["진화", "깨달음", "도약"] },
  { id: "collectibles", label: "내실", headings: ["수집품", "성향"] },
  { id: "avatars", label: "아바타", headings: ["아바타", "아바타 효과"] },
  { id: "stats", label: "통계", headings: ["아이템 레벨", "전투력", "원정대 레벨"] },
  { id: "siblings", label: "원정대", headings: ["아만", "루페온"] },
  { id: "evidence", label: "세팅 점검", headings: ["세팅 점검 결과", "원천 제공 상태"] },
];

test.describe("캐릭터 탭 @smoke", () => {
  for (const tab of TABS) {
    test(`${tab.label} 탭이 오류 없이 열린다`, async ({ page }) => {
      await page.goto(characterPath("상세", tab.id));
      await expect(page.getByRole("heading", { level: 1, name: "상세" })).toBeVisible();
      const tabs = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
      await expect(tabs.getByRole("link", { name: tab.label, exact: true })).toHaveAttribute("aria-current", "page");
      for (const name of tab.headings)
        await expect(page.getByRole("heading", { name, exact: true }).first()).toBeVisible();
      await expect(page.getByText(CONTRACT_FAILURE)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("탭을 누르면 주소가 바뀌고 새로고침해도 유지된다", async ({ page }) => {
    await page.goto(characterPath("상세"));
    const tabs = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
    await tabs.getByRole("link", { name: "스킬", exact: true }).click();
    await expect(page).toHaveURL(/\?tab=skills$/);
    await expect(tabs.getByRole("link", { name: "스킬", exact: true })).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(tabs.getByRole("link", { name: "스킬", exact: true })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "전투", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/character/${encodeURIComponent("상세")}$`));
  });

  test("원정대 탭에서 다른 캐릭터로 이동한다", async ({ page }) => {
    // 이동 대상 캐릭터는 목 서버 기본 표본을 받는다.
    await page.goto(characterPath("상세", "siblings"));
    await page.getByRole("link", { name: /합성원정대/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "합성원정대" })).toBeVisible();
  });
});

test.describe("캐릭터 오류 응답 @smoke", () => {
  const CASES = [
    ["미존재", "404", "캐릭터를 찾지 못했어요"],
    ["제한", "429", "조회 요청이 잠시 많아요"],
    ["오류", "502", "캐릭터 정보를 불러오지 못했어요"],
    ["설정", "503", "조회 서비스 연결을 준비하고 있어요"],
    ["시간초과", "504", "응답이 늦어지고 있어요"],
  ];
  for (const [name, status, title] of CASES) {
    test(`${status} 응답은 '${title}'을 보여 준다`, async ({ page }) => {
      await page.goto(characterPath(name));
      await expect(page.getByRole("alert").filter({ hasText: title })).toBeVisible();
      await expect(page.getByText("private upstream detail")).toHaveCount(0);
    });
  }
});
