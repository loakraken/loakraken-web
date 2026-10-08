# 프론트 운영 이미지

운영 배포 절차·구성 전체는 백엔드 저장소 `docs/ops/deploy.md`에 있다. 이 문서는 프론트 이미지만 다룬다.

## 이미지

- `Dockerfile`: Node 24(bookworm-slim) 3단계 빌드 → `next start`, 비루트 `node` 사용자, 3000번 포트
- 실행 환경변수: `LOAKRAKEN_API_ORIGIN`(서버 전용, 운영 compose에서 `http://api:8080`). 이미지에는 넣지 않는다.
- 헬스 체크: 운영 compose가 `/about` 응답을 확인한다(백엔드를 부르지 않는 경로).
- lint·test·타입 검사는 `frontend-ci.yml`이 하고, 이미지 빌드에서는 `next build`만 한다.

## standalone 전환(후속)

`next.config.ts`에 `output: "standalone"`이 들어오면(web #78) 실행 단계를 바꾼다.

- 복사 대상: `.next/standalone/` → `/app`, `.next/static/` → `/app/.next/static`, `public/` → `/app/public`
- 실행: `node server.js`
- node_modules 전체를 넣지 않아 이미지가 작아진다.

## 이미지 빌드 워크플로

`.github/workflows/image.yml`

- PR: `Dockerfile`·`.dockerignore`·`package.json`·`package-lock.json`·`next.config.ts`·워크플로가 바뀔 때만 빌드 확인(Actions 사용 시간 절약)
- develop·master push·수동 실행: 저장소 변수 `PUBLISH_IMAGES=true`일 때만 `ghcr.io/loakraken/loakraken-web:sha-<커밋7자>`로 올린다. 기본은 꺼져 있다.

## 로컬 확인

```bash
docker build -t loakraken-web:local .
docker run --rm -p 127.0.0.1:3096:3000 -e LOAKRAKEN_API_ORIGIN=http://host.docker.internal:8080 loakraken-web:local
```
