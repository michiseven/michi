FROM node:22-alpine AS build
WORKDIR /app

COPY packages/log-friends-sdk/package.json packages/log-friends-sdk/package-lock.json ./packages/log-friends-sdk/
RUN npm ci --prefix packages/log-friends-sdk
COPY packages/log-friends-sdk/ ./packages/log-friends-sdk/
RUN npm run build --prefix packages/log-friends-sdk

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend
COPY frontend/ ./frontend/

ARG NEXT_PUBLIC_BASE_PATH=/michi
ARG NEXT_PUBLIC_API_URL=/michi/api
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=
ARG NEXT_PUBLIC_LOG_FRIENDS_ENDPOINT=
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE \
    NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=$NEXT_PUBLIC_NAVER_MAP_CLIENT_ID \
    NEXT_PUBLIC_LOG_FRIENDS_ENDPOINT=$NEXT_PUBLIC_LOG_FRIENDS_ENDPOINT
RUN npm run build --prefix frontend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static

USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
