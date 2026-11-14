// 회귀(A7 첫 로드 흔들림, 캐릭터 화면 훑기 1·2차): 첫 HTML은 어디서든 끊겨 올 수 있다. 캐릭터 화면에서 묶음마다 그 안의 모든
// 시작 태그 직후·글자 노드 직후로 문서를 자르고 나머지(뒤의 형제·조상의 뒤 형제)를 페이지 순서대로 되돌려도 배너(정보·사실 칸),
// 탭 줄(탭 + 오른쪽 도구), 장비 패널, 팔찌 줄, 통계 탭 기록 차트가 움직이지 않는다. 배너 정보 칸은 띠 가운데에 놓여 줄이 늦게
// 오면 앞줄이 위로 밀렸고(1280에서 171 → 100px), 탭 줄은 나중에 온 쪽이 높이를 정했고(320 29 → 51px), 기록 차트 칸은 다음
// 칸이 오기 전까지 줄 전체를 차지했다(552 → 361px). 2차: 순위 배지 줄, 각인 유물·스톤 표시, 아바타 줄, 수집품 이름, 성향 값,
// 스킬 포인트, 요약 개수, 원정대 줄과 서버 패널 머리(좁은 여백을 목록이 온 뒤 :has로 정해 머리가 8px 올라감).
// CI 비용(PM 11-14: 한 샤드에 2분 이하): 배너·탭 줄은 모든 탭에서 같은 마크업이라 전투 탭에서만, 테마는 배치를 바꾸지 않아
// 밝은 테마만, 묶음마다 그 묶음 안만 자른다. 8개 탭 × 너비 × 테마 전체는 PR 전에 로컬에서 돈다.
import { test, expect, gotoReady, characterPath } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

// Each block held still, as "selector|text it contains" (cutEverywhere's root): cuts run inside it, and only what moved
// inside it counts. The later parts of the page come back after it, as a split stream brings them.
const BANNER = 'section[aria-label$="캐릭터 요약"]|';
const TAB_BAR = '[data-sticky-chrome]:has(nav[aria-label="캐릭터 정보 탭"])|';
// Cut only within the first screen (900 px) of a block once it is brought into view: the gear panel's later rows past
// that are not cut (enough with the CI character; extend if a taller fixture is added).
const GEAR = 'section[aria-label="장비"]|';
const BRACELET = 'section[aria-label="장비"] [data-wide]|팔찌';
// The first of the three history panels: the later two arriving after it is what widened it.
const HISTORY = 'section[aria-label="아이템 레벨"]|';
const panel = (title) => `section[aria-label="${title}"]|`;

/** Cuts inside each block; every block must have been cut (a lost selector fails) and nothing in it moved. */
async function sweep(page, blocks) {
  const moved = [];
  for (const [name, root] of blocks) {
    await page.evaluate(() => scrollTo(0, 0));
    const cut = await cutEverywhere(page, root);
    expect(cut.probed, `${name}: 잘라 본 곳(${cut.moved.join(" / ")})`).toBeGreaterThan(3);
    if (cut.value > 0) moved.push(`${name} ${cut.value}: ${cut.moved.slice(0, 6).join(" / ")}`);
  }
  expect(moved, "움직인 상자").toEqual([]);
}

for (const width of [320, 360, 390, 1280])
  test(`@A7 ${width} 캐릭터 화면: 첫 HTML이 어디서 끊겨도 배너·탭 줄·장비·팔찌가 움직이지 않는다 @regression`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세"));
    await page.evaluate(() => document.fonts.ready);
    // Every gated block is drawn once its end mark is in (codex #1637 P3: a lost mark would keep one hidden).
    const banner = page.getByRole("region", { name: /캐릭터 요약$/ });
    await expect(banner.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(banner.getByText("길드", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "캐릭터 정보 탭" }).getByRole("link").first()).toBeVisible();
    const gear = page.getByRole("region", { name: "장비", exact: true });
    await expect(gear.locator("li strong").first()).toBeVisible();
    // An accessory row's text too (a gate of its own: the whole row waits for its polish lines).
    await expect(gear.locator("li strong").filter({ hasText: "목걸이" }).first()).toBeVisible();
    await expect(gear.locator("[data-wide]").getByText("팔찌", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "순위", exact: true }).getByText(/대양|심해|해구|크라켄/).first()).toBeVisible();
    await sweep(page, [
      ["배너", BANNER],
      ["탭 줄", TAB_BAR],
      ["장비", GEAR],
      ["팔찌", BRACELET],
      ["순위", panel("순위")],
    ]);
  });

// Batch 2: one test per tab with gated blocks, at the width where they moved.
const TABS = [
  ["arkpassive", 1280, [["각인", panel("각인")]], (page) => page.getByRole("region", { name: "각인", exact: true }).getByText(/×\d/).first()],
  ["avatars", 1024, [["아바타 목록", panel("아바타 목록")]], (page) => page.getByRole("region", { name: "아바타 목록" }).locator("li strong").first()],
  [
    "collectibles",
    1024,
    [
      ["수집품", panel("수집품")],
      ["성향", panel("성향")],
    ],
    (page) => page.getByRole("region", { name: "성향", exact: true }).locator("dd").first(),
  ],
  [
    "skills",
    360,
    [
      ["스킬 포인트", panel("스킬 포인트")],
      ["요약", panel("요약")],
    ],
    (page) => page.getByRole("region", { name: "스킬 포인트", exact: true }).getByText("남은 포인트", { exact: false }),
  ],
  // A server's list (the mock character's roster is on 아만).
  ["siblings", 320, [["원정대 서버 목록", panel("아만")]], (page) => page.getByRole("region", { name: "아만", exact: true }).locator("li").first()],
];
for (const [tab, width, blocks, gated] of TABS)
  test(`@A7 ${width} 캐릭터 ${tab} 탭: 첫 HTML이 어디서 끊겨도 ${blocks.map(([name]) => name).join("·")}이 움직이지 않는다 @regression`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세", tab));
    await page.evaluate(() => document.fonts.ready);
    // The gated block is drawn once its end mark is in.
    await expect(gated(page)).toBeVisible();
    await sweep(page, blocks);
  });

// The charts sit side by side only from two columns up.
test("@A7 1280 캐릭터 통계 탭: 첫 HTML이 어디서 끊겨도 기록 차트 칸이 움직이지 않는다 @regression", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, characterPath("상세", "stats"));
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("region", { name: "아이템 레벨", exact: true })).toBeVisible();
  await sweep(page, [["기록 차트", HISTORY]]);
});
