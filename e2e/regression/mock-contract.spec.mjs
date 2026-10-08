// 회귀: 목 응답이 프론트 계약 검증(lib/*/validate)을 통과하는지 앱의 프록시 경로로 확인한다.
// 2026-10-08 계약 파일과 tests/mock-backend.mjs가 어긋나 /character/상세 가
// "응답 형식이 예상과 달라" 화면을 보인 일이 있었다(web #54 작업 중, PM 검토에서 발견).
// 계약 검증에 실패하면 프록시는 502 INVALID_API_RESPONSE를 돌려준다.
import { test, expect } from "../support/fixtures.mjs";

const q = (params) => new URLSearchParams(params).toString();

// 목 서버가 성공 응답을 주는 캐릭터 이름 전부(tests/mock-backend.mjs).
// '갱신실패'는 첫 호출만 성공하고 이후 502를 주는 갱신 시나리오라 제외한다.
const SUCCESS_NAMES = [
  "상세", "상세서포터", "재련", "이미지", "이미지실패", "마크업",
  "부분", "빈목록", "미제공", "문자열",
];

test.describe("목 응답 계약 @regression", () => {
  for (const name of SUCCESS_NAMES) {
    test(`캐릭터 '${name}' 응답이 계약 검증을 통과한다`, async ({ request }) => {
      const response = await request.get(`/api/characters?${q({ characterName: name })}`);
      const body = await response.json();
      expect(body.error?.code, `'${name}' 목 응답이 계약과 어긋남`).toBeUndefined();
      expect(response.status()).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.envelope.data.characterName).toBe(name);
    });
  }

  test("형식이 틀린 응답은 INVALID_API_RESPONSE로 막힌다(검증이 살아 있음)", async ({ request }) => {
    const response = await request.get(`/api/characters?${q({ characterName: "잘못된응답" })}`);
    expect(response.status()).toBe(502);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "INVALID_API_RESPONSE" } });
  });

  test("원정대·이력·조회수 응답이 계약 검증을 통과한다", async ({ request }) => {
    for (const path of [
      `/api/characters/siblings?${q({ characterName: "상세" })}`,
      `/api/characters/history?${q({ characterName: "상세", serverName: "아만" })}`,
      `/api/characters/views?${q({ characterName: "상세" })}`,
    ]) {
      const response = await request.get(path);
      const body = await response.json();
      expect(body.error?.code, path).toBeUndefined();
      expect(body.ok, path).toBe(true);
    }
  });

  test("시세 탭·전 분류 보드·품목 추이 응답이 계약 검증을 통과한다", async ({ request }) => {
    const tabs = await (await request.get("/api/markets/tabs")).json();
    expect(tabs.ok).toBe(true);
    const ids = tabs.envelope.data.tabs.map((tab) => tab.tab);
    expect(ids.length).toBeGreaterThan(0);
    for (const tab of ids)
      for (const sort of ["default", "high", "low", "rise", "fall"]) {
        const body = await (await request.get(`/api/markets/board?${q({ tab, sort })}`)).json();
        expect(body.error?.code, `${tab}/${sort}`).toBeUndefined();
        expect(body.ok, `${tab}/${sort}`).toBe(true);
      }
    const history = await (await request.get("/api/markets/items/6861012/history")).json();
    expect(history.error?.code).toBeUndefined();
    expect(history.ok).toBe(true);
  });
});
