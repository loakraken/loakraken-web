// 회귀: 목 캐릭터 '상세'·'상세서포터'가 모든 탭에서 계약 실패 화면 없이 열린다.
// 2026-10-08 /character/상세 가 "조회 결과를 확인할 수 없어요 / 응답 형식이 예상과 달라"를
// 보인 문제(목 서버 코드 오류, web #54에서 수정)가 다시 생기지 않는지 고정한다.
import { test, expect, characterPath, CONTRACT_FAILURE } from "../support/fixtures.mjs";

const TABS = ["combat", "simulator", "specup", "skills", "arkpassive", "collectibles", "avatars", "stats", "siblings", "evidence"];

for (const name of ["상세", "상세서포터"]) {
  test.describe(`목 캐릭터 '${name}' @regression`, () => {
    for (const tab of TABS) {
      test(`${tab} 탭에 계약 실패 화면이 없다`, async ({ page }) => {
        await page.goto(characterPath(name, tab));
        await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
        await expect(page.getByText(CONTRACT_FAILURE)).toHaveCount(0);
        await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
      });
    }
  });
}

test("서포터 목 캐릭터는 서포터로 판정된다 @regression", async ({ request }) => {
  const body = await (await request.get(`/api/characters?characterName=${encodeURIComponent("상세서포터")}`)).json();
  expect(body.ok).toBe(true);
  expect(body.envelope.data.analysis.position).toBe("SUPPORT");
});
