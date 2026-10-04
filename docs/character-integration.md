# 캐릭터 관측 화면과 API 연결

2026-10-04 · 프론트 이슈 #5. 실제 서버에 연결하는 코드를 구현했고, 백엔드 생성 명세·합성 fixture와 로컬 테스트 서버로 검증했다. 실행 중인 백엔드가 없어 실제 캐릭터 조회는 아직 미검증이다. 백엔드 파일 수정·서버 기동·공식 인증 API 호출은 하지 않았다.

## 연결 설정

`.env.example`을 `.env.local`로 복사하고 `LOAKRAKEN_API_ORIGIN`을 백엔드 origin으로 설정한다. 기본 로컬 예시는 `http://127.0.0.1:8080`이다. 절대 URL의 origin만 허용하며 경로·인증정보·query·fragment는 허용하지 않는다. 변경 뒤 프론트 서버를 재시작한다.

Lost Ark API 키는 프론트에 넣지 않는다. 브라우저는 같은 출처의 `/api/characters`만 호출하며 Next 서버가 `/api/v1/characters/search`로 전달한다. 최초 페이지 조회도 같은 서버 어댑터를 사용한다. API origin은 `NEXT_PUBLIC_` 변수가 아니다.

```sh
npm ci
npm run dev
```

백엔드의 API 키·Valkey 등 실행 준비는 백엔드 작업 범위다. 포트가 열리지 않으면 조회 실패 안내가 표시된다. 프론트가 백엔드를 자동 기동하지 않는다.

## 데이터와 호출 정책

- 이름: trim → NFC → 문자·숫자 1~64자. 직접 URL과 브라우저 입력 모두 검증한다.
- 요청당 QueryClient를 만들어 서버 결과를 hydration한다. 최초 조회 후 브라우저 중복 요청, 자동 재시도, 창 포커스/재연결 갱신, 주기적 조회는 하지 않는다. 원정대 링크도 `prefetch={false}`다.
- 수동 재조회 중에는 마지막 데이터를 유지한다. 갱신 실패 시 오류와 기존 수집 시각을 함께 표시한다. 프론트 fetch와 응답은 `no-store`이며 백엔드 캐시만 사용한다.
- 사용자가 알려준 공식 제한은 100회/분이다. 확인한 백엔드는 캐릭터·거래소 공통 90회/분 예산과 동시성 4를 사용한다. 캐릭터 캐시 미적중 한 번에 전투정보·원정대의 외부 요청 2회를 사용한다. 따라서 화면 조회 횟수와 공식 호출 횟수는 다르다.
- 429는 Retry-After를 사용하고 헤더가 없으면 60초 대기한다. 대기가 끝나도 자동 재조회하지 않는다. UI 대기는 전역 호출 예산의 대체 수단이 아니며 전체 제한은 백엔드가 담당한다.
- `fetchedAt`은 원천 수집 완료 시각이다. KST로 표시하며 5분 이상이면 경과 안내를 보인다. 게임 내 변경 시각이나 실제 캐시 만료를 뜻하지 않는다. 서버 캐시가 유지되는 재조회에서는 시각이 바뀌지 않는다.
- 요청 전체 제한 시간은 15초다. 400/404/429/502/503/504와 잘못된 응답을 구분하고 내부 오류 본문을 표시하지 않는다.

## 관측 화면

프로필·능력치·장비·보석·각인·카드·아크패시브·아크그리드·원정대를 표시한다. coverage의 `NOT_PROVIDED`, `PROVIDED_EMPTY`, `PROVIDED`를 영역과 하위 컬렉션에 반영한다. **빈 목록을 미착용으로 판단하지 않는다.** 원천 섹션 null은 외부 데이터 미제공이며 네트워크 부분 실패가 아니다. 현재 백엔드는 전투정보와 원정대 요청이 모두 성공해야 응답한다.

진단은 정보 부족/세팅 확인으로 구분하고, 규칙 버전과 전체 응답 기준 JSON Pointer 근거를 펼치고 복사할 수 있다. 관측값 `0`, `false`, `null`을 누락과 구분한다. 새 진단 코드도 기존 범주·형식이 유효하면 메시지와 근거를 표시한다. 진단 항목이 없다는 것을 완성된 세팅이라고 표현하지 않는다.

외부 문자열은 텍스트로 렌더링한다. 프로필 이미지는 알려진 공식 HTTPS 호스트만 허용하고 실패하면 이름 첫 글자를 표시한다. 점수·DPS·비용은 이번 화면에서 계산하지 않는다.

Apple 라이트 디자인과 오브 로딩, 수치 영역 진입 모션을 유지한다. 모션 정지·탭 비활성·OS reduced-motion 변경에 즉시 반응한다. Next의 streaming 상세 경로는 JavaScript가 필요하므로 비활성 환경에서는 명시적인 안내와 홈 링크를 제공한다. 홈의 예시 본문은 JavaScript 없이 읽을 수 있다.

## 계약 재생성

원본은 읽기 전용으로 확인한 `../loakraken/build/generated/openapi.json`이다. 확인 시 백엔드 develop 기준은 `7b336006124b1106c0568a2619f5bef02c7a23d8`, 작업 브랜치는 `feat/39-material-quotes`였다. 작업 중인 시장 API를 섞지 않고 캐릭터 경로와 참조 스키마 38개만 추출했다. 로컬 생성 파일이므로 해당 커밋과 바이트 단위 동일성을 보증하는 것은 아니다.

```sh
node scripts/sync-character-contract.mjs ../loakraken/build/generated/openapi.json
npm run api:generate
npm test
```

캡처 SHA-256: `703b8db2c7499ac76dc53cde6b9e166ca06513510c4f23c22a8ebb3ba51cfae7`.

`contracts/character.openapi.json` → `lib/api/schema.d.ts`. 원본 필드명을 수작업으로 복제하지 않는다. Ajv가 같은 명세로 응답을 검사하며, 진단 code enum만 확장 가능한 문자열로 완화한다. 테스트 fixture는 백엔드 생성 합성 데이터다. 실제 계정 응답 `character-live.json`은 포함하지 않았다.

## 검증과 재현

- `npm test`: 계약·잘못된 응답·이름·JSON Pointer·안전한 이미지·요청 횟수·상태별 오류·호출 제한·본문 수신 중 시간 초과까지 18개.
- `npm run lint`, `npm run build`로 TypeScript와 프로덕션 빌드를 검사한다.
- CI는 위 검증과 API 타입 재생성 후 변경 없음까지 검사한다.
- 브라우저 검증은 합성 서버로만 실행하며 공식 API를 호출하지 않는다. 아래 실행마다 mock을 새로 시작한다.

```sh
# 터미널 1: 합성 fixture만 제공
npm run test:mock
# 터미널 2: 쉘에 LOAKRAKEN_API_ORIGIN=http://127.0.0.1:4180 설정 후
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
# 터미널 3: Playwright와 Edge가 있는 환경
node tests/browser-check.mjs
```

Playwright가 프로젝트 밖에 설치되어 있으면 `PLAYWRIGHT_MODULE`에 해당 모듈 경로를 지정한다. Chrome 환경은 `TEST_BROWSER=chrome`, 출력 폴더는 `TEST_OUTPUT`으로 지정할 수 있다. 테스트 후 mock과 해당 preview 프로세스를 종료하고 실제 origin으로 되돌린다. mock을 실제 데이터 서비스로 사용하지 않는다.

브라우저 검증: SSR 중복 호출·원정대 prefetch 없음, 근거 키보드/복사, 수동 갱신과 실패 보존, 429 대기·자동 호출 없음, 오류별 안내, coverage 구분, 64자 이름·HTML 문자열, NFC 검색·오브 로딩, 잘못된 URL, JavaScript 비활성 안내. 1440/768/390/320px 가로 넘침과 런타임 오류를 검사한다.

화면의 `전체`, `테스트 무기` 등은 테스트용 데이터다. 결과: [브라우저 기록](previews/character-browser-results.json), [데스크톱](previews/character-desktop.png), [모바일](previews/character-mobile.png).

실제 백엔드 서버가 준비되면 캐시 미적중 1건·재조회 1건을 우선 확인하고 공식 사용량을 관찰한다. 현재까지 이번 프론트 구현·검증의 공식 인증 API 호출은 **0회**다.
