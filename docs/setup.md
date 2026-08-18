# 로컬 개발 환경 설정

## 사전 요구 사항

- Node.js 22 이상
- npm
- Docker Desktop, OrbStack 또는 다른 Docker Compose 구현체

Compose 파일은 PostGIS 3.5가 포함된 PostgreSQL 17을 실행합니다. PostgreSQL은 컨테이너 내부에서 `5432` 포트를 사용하며, 로컬에 설치된 PostgreSQL과 흔히 충돌하는 상황을 피하기 위해 호스트 포트는 기본적으로 `55432`를 사용합니다. 선택한 이미지는 `linux/amd64`로 선언되어 있으며, Apple Silicon에서는 컨테이너 에뮬레이션을 통해 실행됩니다.

## 1. 환경변수 설정

프로젝트 루트에서 다음 명령을 실행합니다.

```bash
cp .env.example .env
```

기본값은 장소, 혼잡도, 선호도 분석에 Mock 동작을 사용하므로 외부 credential이 필요하지 않습니다. `.env.example`이나 소스 파일에 secret을 넣지 마세요.

주요 값은 다음과 같습니다.

```env
DATABASE_URL=postgresql://michi:michi@localhost:55432/michi
DB_PORT=55432
PLACE_PROVIDER_MODE=mock
CROWD_PROVIDER_MODE=mock
LLM_PROVIDER_MODE=mock
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_LOG_FRIENDS_ENDPOINT=
```

`NEXT_PUBLIC_DEMO_MODE=true`로 설정하면 backend를 거치지 않고 명시적인 frontend 데모 fixture를 사용합니다. frontend/backend 통합을 테스트할 때는 `false`로 유지하세요.

## 2. 의존성 설치

```bash
npm --prefix backend ci
npm --prefix packages/log-friends-sdk ci
npm --prefix packages/log-friends-sdk run build
npm --prefix frontend ci
```

Frontend는 SDK를 로컬 `file:` 의존성으로 사용합니다. Frontend의 `predev`, `pretest`, `prebuild` 스크립트가 SDK를 컴파일하며, 위의 명시적인 SDK 빌드 명령은 새 환경에서 설정 과정과 오류 발생 지점을 분명하게 보여줍니다.

## 3. 데이터베이스, 마이그레이션, 시드

```bash
docker compose up -d db
npm --prefix backend run migration:run
npm --prefix backend run seed
```

기본 seed 명령은 어떤 행도 추가하지 않습니다. 합성 POI 하나를 Mock 데이터임이 명확한 상태로 추가하려면 다음 명령을 사용합니다.

```bash
SEED_MOCK_DATA=true npm --prefix backend run seed
```

여행 생성은 seed 행에 의존하지 않습니다. 결정론적 fixture는 `MockPlaceProvider`가 관리합니다.

유용한 데이터베이스 명령은 다음과 같습니다.

```bash
npm --prefix backend run migration:show
npm --prefix backend run migration:revert
docker compose down
```

`docker compose down`은 이름이 지정된 데이터베이스 볼륨을 보존합니다. 로컬 데이터베이스 데이터를 의도적으로 삭제하려는 경우에만 `-v`를 추가하세요.

## 4. 실행

VS Code 사용자는 프로젝트 루트의 `Michi.code-workspace`를 열면 frontend, backend, design system, docs, packages가 각각 독립된 최상위 폴더로 표시됩니다. `Tasks: Run Task`에서 DB 시작, 마이그레이션, frontend/backend 개발 서버, 전체 검증 작업도 실행할 수 있습니다.

`Run and Debug`에서는 다음 구성을 사용할 수 있습니다.

- `Michi: Backend debug`: DB 시작과 마이그레이션 후 NestJS를 watch/Node Inspector 모드로 실행합니다.
- `Michi: Frontend debug`: SDK를 빌드하고 Next.js 서버를 실행한 뒤 Chrome 디버거를 연결합니다.
- `Michi: Frontend browser only`: 이미 실행 중인 `localhost:3000`에 브라우저 디버거만 연결합니다.
- `Michi: Full stack debug`: backend와 frontend를 함께 시작하고 중지합니다.

각각 별도의 터미널에서 실행합니다.

```bash
npm --prefix backend run start:dev
```

```bash
npm --prefix frontend run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000/api`
- 상태 확인: `http://localhost:4000/api/health`

## 5. 검증

```bash
docker compose config
npm --prefix backend run lint
npm --prefix backend test
npm --prefix backend run build
npm --prefix packages/log-friends-sdk run lint
npm --prefix packages/log-friends-sdk test
npm --prefix packages/log-friends-sdk run build
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```

통합 smoke test를 수행하려면 `NEXT_PUBLIC_DEMO_MODE=false`를 유지하고 데이터베이스와 API를 시작한 다음, `/api/trips/generate`에 일본어 요청을 전송하세요. 이후 응답에 mock/live 모드가 표시되고 각 stop에 좌표, `reason`, `scoreBreakdown`이 포함되는지 확인합니다.

## Live 제공자 설정

- NAVER Local Search: `PLACE_PROVIDER_MODE=live`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 설정합니다.
- Seoul Open Data: `CROWD_PROVIDER_MODE=live`와 `SEOUL_OPEN_DATA_API_KEY`를 설정합니다.
- NAVER Maps: frontend에 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`를 설정합니다.
- OpenAI 선호도 분석: `LLM_PROVIDER_MODE=live`, `OPENAI_API_KEY`와 선택적으로 `OPENAI_MODEL`을 설정합니다.
- Log Friends 이벤트 batch: `NEXT_PUBLIC_LOG_FRIENDS_ENDPOINT`를 절대 경로의 ingest URL로 설정합니다. 값이 비어 있으면 이벤트는 크기가 제한된 메모리 queue에 남고 네트워크 요청은 발생하지 않습니다.

모든 live adapter는 Mock 데이터로 조용히 대체하지 않고 오류를 명시적으로 반환합니다. 로컬 QA에서는 외부 credential을 사용하지 않았으므로 live provider 코드는 구현되어 있지만 실제 credential 검증은 완료되지 않았습니다.

## NAS Kubernetes 배포

운영 배포는 저장소 루트의 `backend/Dockerfile`, `frontend/Dockerfile`, `deploy/kubernetes.yaml`을 사용합니다. 현재 NAS 배포는 별도 PostgreSQL Pod를 만들지 않고 기존 PostgreSQL 서버의 독립된 `michi` 데이터베이스를 사용합니다. 접속 문자열은 저장소가 아니라 `michi-runtime` Kubernetes Secret에만 보관합니다.

- Frontend: `http://choi1994.tplinkdns.com/michi`
- Backend: `http://choi1994.tplinkdns.com/michi/api`
- 상태 확인: `http://choi1994.tplinkdns.com/michi/api/health`

상세 빌드, Secret 생성, 이미지 반입, 배포와 검증 절차는 [deployment.md](deployment.md)를 참고하세요.
