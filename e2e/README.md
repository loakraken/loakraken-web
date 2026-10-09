# e2e — QA 스모크·회귀 테스트

QA·테스트팀이 관리하는 Playwright 테스트다. 루트 패키지와 의존성을 나누려고 `e2e/` 안에 별도 `package.json`을 둔다.

- 백엔드는 `tests/mock-backend.mjs`(합성 데이터)만 쓴다. 로스트아크 공식 API와 OpenAI는 호출하지 않는다.
- 외부 요청은 막는다. 공식 CDN 이미지는 1×1 PNG로 대신 응답한다.
- 콘솔 오류나 페이지 오류가 나면 테스트가 실패한다. 단, 로컬 `/api/` 응답의 4xx·5xx 로그는 오류 흐름 테스트에서 일부러 내는 것이라 제외한다.

## 실행

```bash
cd e2e
npm ci
npx playwright test              # 전체 (desktop-1440 전체 + tablet-768·mobile-390 스모크)
npx playwright test --grep @smoke
npx playwright test --grep @regression
npx playwright show-report       # 실패 시 trace·스크린샷
```

- 포트: 앱 3200, 목 3201(QA 대역). `E2E_WEB_PORT`, `E2E_MOCK_PORT`로 바꾼다.
- 이미 떠 있는 서버를 재사용한다. CI에서는 새로 띄운다.
- 다른 미리보기(예: PR 작업 트리)를 검사하려면 `E2E_BASE_URL=http://localhost:3002 npx playwright test`로 실행한다. 이때 서버는 띄우지 않는다.
- 브라우저: 기본은 설치된 Chrome(`channel: chrome`)이다. CI에서 크로미움을 쓰려면 `npx playwright install chromium` 후 `E2E_CHANNEL=chromium`으로 실행한다.

## 구성

| 경로 | 내용 |
|---|---|
| `smoke/home.spec.mjs` | 홈·/about 검색(정상·빈 값·문자 제한·64자 초과), Ctrl K 포커스 |
| `smoke/home-dashboard.spec.mjs` | 홈 일정·시세·공지, 요일 선택 재조회, 점검 배너, 08:00·13:30·23:30 섹션 문구, 지난 회차 숨김 켬·끔(시계 고정) |
| `smoke/site-nav.spec.mjs` | 상단 메뉴 이동·호버·↓/Esc/←→, 성장 도구 메뉴(경매·돌파고)·현재 위치, 390px 메뉴 시트·Esc 포커스 복귀 |
| `smoke/character.spec.mjs` | 캐릭터 8개 탭, 탭 이동·새로고침 유지, 원정대 이동, 404·429·502·503·504 |
| `smoke/market.spec.mjs` | 시세 분류·정렬·페이지·품목 추이·기간 |
| `smoke/tools.spec.mjs` | 재련 기대 비용(계산·장비 불러오기), 재료 구매 견적, 치적·뭉가·음돌, 돌파고(확률·깎기·되돌리기·주소 복원·필요한 돌) |
| `smoke/auction.spec.mjs` | 경매 입찰가: 일로아 대조 100,000G·8인, 수수료 올림(99,999G), 프리셋 4·8·16·30, 직접 입력·범위 오류, 가격 오류, 화살표 키, 주소 유지 |
| `regression/mock-contract.spec.mjs` | 목 응답이 앱 프록시의 계약 검증을 통과하는지(캐릭터·원정대·이력·조회수·카드 기록·시세·홈) |
| `regression/detail-mock.spec.mjs` | '상세'·'상세서포터' 전 탭에 계약 실패 화면이 없음 |
| `regression/aria-expanded.spec.mjs` | 펼침 버튼 aria-expanded(아크 그리드·기록 표·스킬·상단 메뉴, 전 탭 검사) |
| `regression/material-quote-options.spec.mjs` | 카테고리 목록 도착 전 검색 시 모순된 오류 |
| `regression/focus-retention.spec.mjs` | 키보드 실행 뒤 로딩 중·완료 후 포커스가 BODY로 사라지지 않음(성장 도구 3화면·시세) |
| `regression/dark-mode.spec.mjs` | OS 다크 모드에서 7개 화면 제목·본문 대비 4.5:1 이상 |
| `regression/favorites.spec.mjs` | 즐겨찾기 추가 → 새로고침 → 새 탭 홈 목록 → 해제, 깨진 저장소 |
| `regression/card-panel.spec.mjs` | 전투 탭 카드 패널 구조(카드 이름·각성·세트 효과), 원정대 카드 기록(web #85부터 카드 패널 안, 역할 세트·6속성·빈 기록) |

## 알려진 실패

`test.fail()`로 표시한 테스트는 열린 버그를 재현한다. 버그를 고치면 Playwright가 "예상 밖 통과"로 알려 준다. 그때 해당 줄을 지운다.

- 지금은 없다.
