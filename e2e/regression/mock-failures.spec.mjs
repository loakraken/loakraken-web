// 회귀: 목 백엔드 실패 장치(POST /__fail, web #296)로 서버·브라우저 요청을 함께 실패시킨다.
// - 홈 인기 검색: 서버 선조회 실패 → 브라우저 재조회도 실패 → 실패 안내(PM-프론트 #236 후속)
// - 시세 1분 갱신(web #285): 503·429여도 보이던 목록을 유지하고 안내만 띄운다
// 실패 예약은 목 전체가 공유한다. 이 파일은 차례로(serial) 돌리고, 끝날 때마다 예약을 지운다.
// 브라우저 조회는 실패하면 자동 재시도하므로(기본 3회) 예약 횟수를 넉넉히(20) 잡는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const MOCK = process.env.E2E_MOCK_URL ?? `http://127.0.0.1:${process.env.E2E_MOCK_PORT ?? 3201}`;
const failNext = (request, plan) => request.post(`${MOCK}/__fail`, { data: plan });

test.describe("목 실패 장치 @regression", () => {
  test.describe.configure({ mode: "serial" });
  test.afterEach(async ({ request }) => {
    await request.delete(`${MOCK}/__fail`);
  });

  test("홈 인기 검색: 서버 선조회와 브라우저 재조회가 모두 실패하면 실패를 안내한다", async ({ page, request }) => {
    expect((await failNext(request, { path: "/api/v1/characters/popular", status: 502, times: 20 })).ok()).toBe(true);
    await gotoReady(page, "/");
    const card = page.getByRole("region", { name: "인기 검색 캐릭터" });
    await expect(card).toContainText("순위를 불러오지 못했어요.");
    await expect(card.getByRole("listitem")).toHaveCount(0);
  });

  for (const [status, notice] of [
    [503, /최신 값을 불러오지 못했어요 · 1분 뒤 다시 불러와요/],
    [429, /최신 값을 불러오지 못했어요 · \d+초 뒤 다시 불러와요/],
  ])
    test(`시세 1분 갱신이 ${status}이어도 보이던 목록을 유지한다`, async ({ page, request }) => {
      // 브라우저 시계를 61초 과거에서 시작해, 앞으로 돌린 뒤 실제 시각(앱 서버가 Retry-After를 계산하는 시각)과 맞춘다.
      await page.clock.install({ time: new Date(Date.now() - 61_000) });
      await gotoReady(page, "/market");
      const board = page.getByRole("region", { name: /재련 재료 시세/ });
      await expect(board.getByRole("listitem")).toHaveCount(10);
      expect((await failNext(request, { path: "/api/v1/markets/board", status, times: 20 })).ok()).toBe(true);
      await page.clock.fastForward(61_000);
      // 503은 자동 재시도(대기 1·2·4초)를 거친다. 고정한 시계를 그만큼 흘려 준다.
      await page.clock.runFor(10_000);
      await expect(page.getByText(notice)).toBeVisible();
      await expect(board.getByRole("listitem")).toHaveCount(10);
      await expect(page.getByText(/응답 형식이 예상과 달라|시세를 불러오지 못했어요/)).toHaveCount(0);
    });
});
