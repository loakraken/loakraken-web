# 계산 검증 표본 사본

계산 검증팀이 백엔드 저장소(`loakraken/loakraken`)의 `src/test/resources/verification/`에 둔 표본을 그대로 복사했다. 원본을 고치면 여기도 같이 고친다. `tests/verification.test.ts`가 `npm test`에서 읽는다.

| 파일 | 원본 | 복사 시점 커밋 |
|---|---|---|
| `ability-stone/official-iloa-2026-10-09.json` | 백엔드 PR #155 (`test/153-ability-stone-cross-check`) | `09d26e0` |
| `auction/iloa-loalab-2026-10-09.json` | 백엔드 PR #157 (`test/156-auction-cross-check`) | `9b4351c` |

두 PR이 develop에 병합되면 병합 커밋으로 이 표를 갱신한다.
