// 회귀: 도구 화면에 다른 사이트·저장소 이름이 나가지 않는다(사용자 2026-10-10 23:25).
// 백엔드가 내려주는 출처·가정 문장도 화면에 그대로 나가므로 결과까지 띄운 뒤 본다.
// 이름 목록은 공개 저장소에 두지 않는다 — scripts/blocked-terms.mjs가 CI 비밀값
// BLOCKED_TERMS나 로컬 .blocked-terms에서 읽는다. 목록이 없으면 일반 표현만 본다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { blockedPattern, loadBlockedTerms } from "../../scripts/blocked-terms.mjs";

const GENERIC = /목표 사이트|다른 계산 사이트/i;
const blocked = loadBlockedTerms();
const listed = blockedPattern(blocked.terms.filter((t) => t.kind === "site"));
const NAMES = listed ? new RegExp(`${listed.source}|${GENERIC.source}`, "i") : GENERIC;
// 목 서버는 어떤 이름이든 같은 캐릭터를 돌려준다 — 실제 캐릭터명 대신 익명 ID.
const CHARACTER = encodeURIComponent("목캐릭터A");

const PAGES = [
  {
    name: "재련 기대 비용(결과 포함)",
    path: "/tools/refining",
    run: (page) => page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click(),
    ready: (page) => page.getByRole("region", { name: "예상 소모" }).getByText(/총 \d+단계/),
  },
  { name: "치적·뭉가·음돌", path: `/tools/crit-speed?character=${CHARACTER}` },
  { name: "경매 입찰가", path: "/tools/auction" },
  { name: "더보기 손익", path: "/tools/more-reward" },
  { name: "레이드 보상표", path: "/tools/raid-rewards" },
  { name: "숙제 체크", path: "/tools/homework" },
  { name: "전투력 시뮬레이터", path: `/tools/combat-power?character=${CHARACTER}` },
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
