# syntax=docker/dockerfile:1.7
# LOAKraken 프론트 운영 이미지. lint·test·타입 검사는 CI(frontend-ci.yml)에서 실행한다.
# 백엔드 주소(LOAKRAKEN_API_ORIGIN)는 서버 전용 실행 환경변수로 받으며 이미지에 넣지 않는다.
# next.config.ts에 output: "standalone"이 들어오면 실행 단계를 .next/standalone 복사 방식으로 바꾼다(docs/ops/frontend-image.md).

FROM node:24.21.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24.21.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
# .next/cache는 실행 중에 쓰이므로 실행 사용자 소유로 둔다.
COPY --from=build --chown=node:node /app/.next ./.next

USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
