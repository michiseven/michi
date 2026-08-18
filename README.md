# Michi

Michi는 일본인 사용자를 위한 서울 여행 일정 서비스입니다. 자연어 취향을 검증된 제약조건으로 변환하고, 외부 제공자가 확인한 장소를 검색한 뒤 결정론적으로 점수를 계산하여 설명 가능한 일정을 만듭니다.

## 아키텍처

- `frontend/`: Next.js 기반 모바일 우선 플래너, 일정 상세, 지도 UI
- `backend/`: NestJS API, PostgreSQL/PostGIS, 외부 서비스 어댑터, 추천 엔진, 경로 최적화기
- `packages/log-friends-sdk/`: 개인정보 보호를 고려한 Phase 2 이벤트 SDK
- `docs/`: 실제 구현된 아키텍처, 설정, API, 데이터, 개인정보 보호, 현재 상태 문서

## 빠른 시작

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm --prefix backend install
npm --prefix packages/log-friends-sdk install
npm --prefix packages/log-friends-sdk run build
npm --prefix frontend install
docker compose up -d db
npm --prefix backend run migration:run
npm --prefix backend run seed
```

그다음 별도 터미널에서 `npm --prefix backend run start:dev`와 `npm --prefix frontend run dev`를 실행합니다.

VS Code에서는 [`Michi.code-workspace`](Michi.code-workspace)를 열면 frontend, backend, design system, docs, packages가 각각 독립된 최상위 폴더로 표시됩니다. DB·마이그레이션·전체 검증 Task와 frontend/backend 단독 또는 동시 디버그 구성을 바로 사용할 수 있습니다.

인증정보 없이 명시적인 Mock 모드로 시작할 수 있습니다. 전체 실행 절차는 [`docs/setup.md`](docs/setup.md), 실제 구현 상태는 [`docs/current-status.md`](docs/current-status.md)를 확인하세요.

현재 NAS 배포는 `http://choi1994.tplinkdns.com/michi`에서 확인할 수 있습니다. 배포 구조와 재배포 절차는 [`docs/deployment.md`](docs/deployment.md)에 기록되어 있습니다.
