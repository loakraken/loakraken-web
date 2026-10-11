// 회귀: 도구 화면에 다른 사이트·저장소 이름이 나가지 않는다(사용자 2026-10-10 23:25).
// 백엔드가 내려주는 출처·가정 문장도 화면에 그대로 나가므로 결과까지 띄운 뒤 본다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const NAMES =
  /일로아|로아랩|로펙|lopec|클로아|kloa|RLoA|rloa|로아와|loawa|icepeng|loa-calc|gcalc|껨산기|lobal|로아쿤|로아로골|loalogol|lo4\.app|목표 사이트|다른 계산 사이트/i;

const PAGES = [
  {
    name: "재련 기대 비용(결과 포함)",
    path: "/tools/refining",
    run: (page) => page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click(),
    ready: (page) => page.getByRole("region", { name: "예상 소모" }).getByText(/총 \d+단계/),
  },
  { name: "치적·뭉가·음돌", path: `/tools/crit-speed?character=${encodeURIComponent("언새늘")}` },
  { name: "경매 입찰가", path: "/tools/auction" },
  { name: "더보기 손익", path: "/tools/more-reward" },
  { name: "레이드 보상표", path: "/tools/raid-rewards" },
  { name: "숙제 체크", path: "/tools/homework" },
  { name: "전투력 시뮬레이터", path: `/tools/combat-power?character=${encodeURIComponent("언새늘")}` },
];

test.describe("도구 화면 다른 사이트 이름 없음 @regression", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "문구는 폭과 무관");
  });
  for (const item of PAGES)
    test(item.name, async ({ page }) => {
      await gotoReady(page, item.path);
      if (item.run) await item.run(page);
      if (item.ready) await expect(item.ready(page)).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main")).not.toContainText(NAMES);
    });
});
