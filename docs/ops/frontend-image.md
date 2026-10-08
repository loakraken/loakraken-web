# 프론트 운영 이미지

운영 배포 절차·구성 전체는 백엔드 저장소 `docs/ops/deploy.md`에 있다. 이 문서는 프론트 이미지만 다룬다.

## 이미지

- `Dockerfile`: Node 24(bookworm-slim) 3단계 빌드. 실행 단계에는 `output: "standalone"` 결과만 담는다.
  - `.next/standalone/` → `/app`, `.next/static/` → `/app/.next/static`, `public/` → `/app/public`
  - 실행: `node server.js`, 비루트 `node` 사용자, `HOSTNAME=0.0.0.0`, `PORT=3000`
  - `/app` 아래(`.next/cache` 포함)는 `node` 소유라 실행 중 캐시 쓰기가 된다.
- 실행 환경변수: `LOAKRAKEN_API_ORIGIN`(서버 전용, 운영 compose에서 `http://api:8080`). 이미지에는 넣지 않는다.
- 헬스 경로: `/about`(백엔드를 부르지 않는다). 운영 compose의 헬스 체크가 이 경로를 쓴다. 이미지를 단독으로 띄울 때도 이 경로로 확인한다.
- lint·test·타입 검사는 `frontend-ci.yml`이 하고, 이미지 빌드에서는 `next build`만 한다.
- 클라이언트 IP: 서버 측 백엔드 호출은 들어온 `x-forwarded-for`를 그대로 넘긴다(web #78). 운영에서는 Next를 직접 노출하지 않고 edge(Caddy)가 이 헤더를 덮어쓴다.

## 이미지 빌드 워크플로

`.github/workflows/image.yml`

- `build-check`(PR, 읽기 권한만): `Dockerfile`·`.dockerignore`·`package.json`·`package-lock.json`·`next.config.ts`·워크플로가 바뀔 때만 빌드 확인(Actions 사용 시간 절약)
- `publish`(develop·master push·수동 실행, `packages: write`): 저장소 변수 `PUBLISH_IMAGES=true`일 때만 `ghcr.io/loakraken/loakraken-web:sha-<커밋7자>`로 올린다. 기본은 꺼져 있다.
- 서드파티 액션은 커밋 SHA로 고정한다(주석에 태그). 갱신은 Dependabot 등으로 SHA를 바꾼다.

## 로컬 확인

```bash
docker build -t loakraken-web:local .
docker run --rm -p 127.0.0.1:3096:3000 -e LOAKRAKEN_API_ORIGIN=http://host.docker.internal:8080 loakraken-web:local
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3096/about
```
