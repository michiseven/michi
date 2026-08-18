# 아키텍처

## 시스템 경계

Michi는 Next.js frontend 하나, NestJS API 하나, PostgreSQL/PostGIS 데이터베이스 하나로 구성된다. 지원 범위는 서울 여행 일정 설계로 한정한다. 브라우저는 취향을 입력받고 경로를 표시·수정하며, 백엔드는 검증, Provider 접근, 정규화, 점수 계산, 일정 배치, 영속화를 담당한다.

```text
Next.js 플래너(일본어 UI)
  -> NestJS /api
       -> PreferencesModule
       -> ProvidersModule
       -> RecommendationModule
       -> TripsModule
       -> TypeORM
  -> PostgreSQL 17 + PostGIS 3.5
```

Queue, message broker, Redis, 검색 cluster, microservice 분리는 사용하지 않는다. Provider cache는 프로세스 내부 TTL map이다.

로컬에서는 frontend `/`, backend `/api`를 사용한다. 현재 NAS 운영 환경은 기존 Log Friends 경로와 분리하기 위해 같은 도메인의 `/michi`에 frontend를, `/michi/api`에 backend를 노출한다. `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_API_URL`, `API_PREFIX`로 이 차이를 구성하며 애플리케이션 코드의 API 계약은 바뀌지 않는다. 운영 데이터베이스는 Kubernetes 내부에 새로 띄우지 않고 기존 PostgreSQL 서버 안의 독립된 `michi` 데이터베이스를 사용한다.

## 런타임 흐름

```text
POST /api/trips/generate
  -> ValidationPipe가 DTO 검증
  -> TripPreferenceParser가 요청 구조화
  -> AJV가 표준 취향 JSON 검증
  -> PlaceSearchQueryGenerator가 카테고리 검색어를 최대 3개 생성
  -> PlaceProvider가 제공자 기반 후보 또는 명확히 표시된 Mock 후보 반환
  -> PlaceNormalizer가 원본 데이터를 보존하고 표준 Place 필드 생성
  -> CrowdProvider가 지역 단위 관측값 하나 반환
  -> DeterministicCandidateRanker가 scoreBreakdown 계산
  -> HeuristicRouteOptimizer가 후보 순서와 일정 계산
  -> TripsService가 여행·감사·경유지 레코드 영속화
  -> { trip, providerModes, warnings }
```

LLM의 경계는 의도적으로 좁게 유지한다. `LLM_PROVIDER_MODE`에 따라 OpenAI Structured Output 파싱 호출 한 번 또는 결정론적 mock parser를 선택한다. 장소, 거리, 점수 계산, 경로 생성은 절대 LLM에 위임하지 않는다.

## 프론트엔드

`frontend/`는 Next.js 16 App Router, React 19, strict TypeScript와 프로젝트 자체 CSS를 위한 build layer인 Tailwind CSS 4를 사용한다.

- `/`: 자연어 여행 planner와 생성된 여행.
- `/trips/[id]`: 저장된 여행 상세와 수정 control.
- `src/lib/api.ts`: 백엔드 envelope 처리, 오류, 선택 가능한 명시적 frontend demo mode.
- `TripView`: Provider mode/warning, timeline, 추천 점수 근거, 혼잡도 범위, 수정 action.
- `NaverMap`: client map loader. Map ID가 없거나 load할 수 없을 때 coordinate list fallback을 제공한다.

Frontend는 `NEXT_PUBLIC_API_URL`을 통해 백엔드를 호출한다. NAVER/Seoul/OpenAI 백엔드 credential은 브라우저 코드에서 사용하지 않는다. `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`는 의도적으로 공개되는 값이다.

## 백엔드 모듈

- `DatabaseModule`: TypeORM 연결. `synchronize`와 migration 자동 실행은 비활성화한다.
- `PreferencesModule`: OpenAI/mock parser 선택, schema 검증, 서울 지역 정규화, parse endpoint.
- `ProvidersModule`: 장소·혼잡도 live/mock adapter와 normalizer/cache.
- `RecommendationModule`: 결정론적 ranker와 route optimizer binding.
- `TripsModule`: orchestration, 영속화, 조회, 경유지 변경.
- `HealthModule`: 데이터베이스 상태와 Provider mode 확인.

책임은 module로 분리하지만 백엔드는 하나의 배포 가능한 process다.

## 외부 데이터 제공자 경계

### 장소

```text
PlaceProvider
  -> NaverPlaceProvider (live)
  -> MockPlaceProvider (mock)
```

검색 query는 LLM이 아니라 애플리케이션이 소유한 tag mapping으로 생성한다. Provider record는 `(source, sourcePlaceId)`를 기준으로 중복 제거, 정규화, upsert한다. Provider link가 있으면 identity로 사용하고, 없으면 NAVER adapter가 결정론적으로 파생 identity를 만들고 파생 metadata임을 표시한다.

### 혼잡도

```text
CrowdProvider
  -> SeoulCrowdProvider (live)
  -> MockCrowdProvider (mock)
```

혼잡도 데이터에는 항상 `scope: "area"`가 지정된다. 성수 지역의 값은 혼잡도 적합성 점수에 영향을 줄 수 있지만, 특정 카페의 내부 인원 현황으로 표시하지 않는다.

### 취향 분석기

```text
TripPreferenceParser
  -> OpenAIProvider (live)
  -> MockTripPreferenceParser (mock/default)
```

Live adapter는 Responses API Structured Output을 한 번 호출하고, 서버 검증 전에 명시적인 form field override를 다시 적용한다. 로컬 QA에서는 credential로 검증하지 않았다.

## 추천과 경로의 경계

Ranker는 모든 점수를 백엔드 코드에서 계산하고 후보별 `scoreBreakdown`을 반환한다. 사용자가 직접 `avoid: crowded`를 입력하면 crowd weight가 증가한다. 결과와 장소별 구성 요소 점수는 audit을 위해 저장한다.

Route optimizer는 Haversine 거리와 추천 점수, 근접성, category 다양성, 식사 시간으로 구성된 greedy utility를 사용한다. 이동 시간은 시속 4.5km 도보와 최소 5분을 가정한다. 시간 범위, 확인된 예산, 확인된 영업시간 구간을 적용한 뒤 독립적인 validator를 실행한다. 현재 Provider 장소 adapter는 비용과 영업시간을 제공하지 않으므로 해당 제약 조건은 대체로 미확인 상태로 남으며 이를 명시한다. 자세한 내용은 [recommendation-engine.md](recommendation-engine.md)와 [route-optimizer.md](route-optimizer.md)를 참고한다.

## 영속화

초기 migration은 PostGIS와 pgcrypto를 활성화하고 다음 구조를 생성한다.

```text
Trip 1--1 TripPreference
Trip 1--* TripStop *--1 Place
Trip 1--1 RecommendationResult 1--* RecommendationScore *--1 Place
ExternalDataSnapshot
JapaneseMarketMetric
UserEvent
```

현재 여행 생성은 여러 repository write로 수행된다. 후속 작업에서 예외가 발생하면 여행을 failed로 표시하지만, 여행 생성 전체를 하나의 database transaction으로 묶지는 않는다. 경유지 순서 변경·재계산은 더 좁은 범위의 TypeORM transaction을 사용한다. 장애 복구에서 중요한 이 차이는 기술 부채로 기록한다.

## 계약과 불확실성

- API JSON은 camelCase를 사용한다.
- 날짜는 `YYYY-MM-DD`, client에 표시하는 여행 시간은 `HH:mm`을 사용한다.
- 금액은 정수 KRW다.
- 좌표는 WGS84 `latitude`/`longitude`다.
- 각 경유지는 `reason`과 `scoreBreakdown`을 반환한다.
- 응답은 Provider mode와 사용자에게 표시할 warning을 반환한다.
- 가격을 알 수 없으면 전체 예상 비용은 `null`이다.
- 확인되지 않은 영업시간, 이미지, 가격, 혼잡도 관측값을 만들어 내지 않는다.

표준 통신 형식은 [api.md](api.md)에 정의되어 있다.

## 2단계 기능 경계

`packages/log-friends-sdk`는 명시적으로 활성화하는 브라우저용 event queue/HTTP batch transport를 구현하고, frontend는 안전한 product event를 전송한다. Michi ingestion endpoint나 영속 event 저장 workflow는 없으며, `UserEvent`는 schema만 존재한다.

`ReceiptsModule`은 `Receipt`, `ReceiptItem`, 사용자 확인 기반 `Visit` entity, 민감한 OCR text redactor, 합성 mock extractor, 결정론적 candidate matcher를 등록한다. Controller, upload/image storage, live OCR/Vision adapter, persistence service, confirmation UI는 없다. 두 Phase 2 기반 기능 모두 추천 생성 과정에는 참여하지 않는다.
