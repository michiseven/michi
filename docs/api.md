# API 계약

백엔드는 `/api` 접두사 아래에서 JSON을 제공한다. JSON 속성은 camelCase를 사용하고, 날짜는 `YYYY-MM-DD`, 날짜가 없는 현지 시간은 `HH:mm`, 타임스탬프는 ISO 8601, 금액은 정수 KRW로 표현한다. 서울 여행 일정의 시간대는 `Asia/Seoul`로 해석한다.

## 공통 규칙

Provider 기반 응답은 fixture와 외부 서비스 중 무엇을 사용했는지 숨기지 않는다.

```ts
type ProviderMode = "mock" | "live";

interface ProviderModes {
  llm: ProviderMode;
  place: ProviderMode;
  crowd: ProviderMode;
}

interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}
```

`warnings`에는 영업시간 미확인, 가격 미확인, 지역 혼잡도 관측값 누락, mock provider 사용 등 사용자에게 표시할 제약 사항이 포함된다. 경고를 임의로 만들어 낸 대체 값으로 채우지 않는다.

## 여행 생성

### `POST /api/trips/generate`

요청을 파싱하고, Provider 기반 후보를 불러온 뒤 백엔드 코드에서 점수 계산과 경로 생성을 수행한다. 결과를 저장하고 생성된 여행 하나를 반환한다.

```ts
interface GenerateTripRequest {
  text: string;          // 필수, 일본어 자연어 요청
  travelDate?: string;  // YYYY-MM-DD
  startTime?: string;   // HH:mm
  endTime?: string;     // HH:mm
  budget?: number;      // 정수 KRW
  startArea?: string;
}
```

명시적으로 입력한 폼 필드는 `text`에서 파싱한 값과 충돌할 경우 우선 적용되며, 이 값도 검증 대상이다. 종료 시간이 시작 시간보다 늦지 않으면 API는 요청을 거부하며, 다음 날로 조용히 넘겨 해석하지 않는다.

```json
{
  "text": "明日、聖水で一人で静かに過ごしたい。夜は焼肉を食べたい。",
  "travelDate": "2026-08-19",
  "startTime": "13:00",
  "endTime": "21:00",
  "budget": 80000,
  "startArea": "성수"
}
```

성공: `201 Created`.

```ts
interface GenerateTripResponse {
  trip: TripDto;
  providerModes: ProviderModes;
  warnings: string[];
}

interface TripDto {
  id: string;
  date: string;
  status: "ready" | "modified";
  startTime: string;
  endTime: string;
  budget: number | null;
  estimatedTotalCost: number | null;
  preference: TripPreferenceDto;
  appliedWeights: ScoreWeights;
  stops: TripStopDto[];
}

interface TripPreferenceDto {
  area: string | null;
  startTime: string;
  endTime: string;
  budget: number | null;
  companions: string | null;
  pace: string | null;
  interests: string[];
  preferences: string[];
  avoid: string[];
}

interface TripStopDto {
  id: string;                    // PATCH에서 사용하는 TripStop ID
  order: number;                 // 1부터 시작하는 연속된 순서
  placeId: string;
  placeName: string;
  category: string | null;
  address?: string;
  latitude: number;
  longitude: number;
  arrivalAt: string;
  leaveAt: string;
  estimatedStayMinutes: number;
  estimatedCost?: number;
  reason: string;
  crowd?: CrowdContextDto;
  scoreBreakdown: ScoreBreakdown;
}

interface CrowdContextDto {
  level: string | null;
  scope: "area";
  areaName: string;
  observedAt: string | null;
  disclaimer: string;
  providerMode: ProviderMode;
}

interface ScoreWeights {
  preference: number;
  crowd: number;
  distance: number;
  time: number;
  budget: number;
  diversity: number;
  area: number;
}

interface ScoreBreakdown extends ScoreWeights {
  total: number;
}
```

모든 구성 요소 점수와 `total`은 `[0, 1]` 범위다. `scoreBreakdown`은 구성 요소별 점수를 담고, `trip.appliedWeights`는 결과 계산에 사용한 가중치를 담는다. 외부 신호가 없으면 버전이 지정된 점수 정책에 따라 처리하고 `warnings`에 알리며, 실제 관측값인 것처럼 대체하지 않는다.

Provider 또는 설정된 fixture 값만으로 전체 여행 비용을 계산할 수 없으면 `estimatedTotalCost`는 `null`이다. 백엔드는 일부 항목만 확인된 합계를 전체 예상 비용으로 바꾸지 않는다.

## 취향 파싱

### `POST /api/preferences/parse`

장소 검색이나 순위 계산 없이 여행 생성에 사용하는 것과 동일한 검증된 파서를 제공한다. UI 미리보기와 파서 계약 테스트에 사용할 수 있다.

요청은 `GenerateTripRequest`를 사용한다. 성공: `200 OK`.

```ts
interface ParsePreferenceResponse {
  preference: TripPreferenceDto;
  parserMode: ProviderMode;
  warnings: string[];
}
```

OpenAI live 모드는 Structured Output을 사용한 뒤 서버에서 스키마를 검증해야 한다. Mock 모드는 명확히 식별되는 결정론적 파서 결과를 반환한다. 어떤 모드도 장소 이름을 추천 결과로 반환해서는 안 된다.

## 여행 조회 및 수정

### `GET /api/trips/:id`

성공: 생성 API와 동일한 envelope를 사용하는 `200 OK` 응답을 반환한다.

```ts
interface TripResponse {
  trip: TripDto;
  providerModes: ProviderModes;
  warnings: string[];
}
```

### `PATCH /api/trips/:id/stops`

요청 하나당 원자적 작업 하나를 지원한다.

```ts
type PatchTripStopsRequest =
  | { action: "remove"; stopId: string }
  | { action: "reorder"; stopIds: string[] }
  | { action: "recalculate" };
```

- `remove`: 이 여행에 속한 경유지 하나를 삭제한 뒤, 연속된 순서와 경로 시간을 다시 계산한다.
- `reorder`: 현재 경유지의 모든 ID가 정확히 한 번씩 포함되어야 한다. 배열 순서를 유지한 채 경로 시간을 다시 계산하고 검증한다.
- `recalculate`: 현재 경유지 집합과 요청된 순서를 유지하면서 도착·출발 시간과 제약 조건을 다시 계산한다.

성공: `TripResponse`를 담은 `200 OK`. 변경 작업은 트랜잭션으로 실행된다. 소유 관계가 잘못되었거나, ID가 중복되거나, 순서 변경 시 ID가 누락되거나, 실행 불가능한 경로인 경우 경유지를 일부만 변경하지 않고 전체 작업이 실패한다.

## 상태 확인

### `GET /api/health`

프로세스가 요청을 처리할 준비가 되면 `200 OK`를 반환한다. 데이터베이스와 모드를 명시하여 정상 상태인 mock 개발 환경을 live 연동으로 오해하지 않게 한다.

```ts
interface HealthResponse {
  status: "ok" | "degraded";
  database: "connected" | "unavailable";
  providerModes: ProviderModes;
  timestamp: string;
}
```

## 오류 코드

| 상태 | 코드 | 의미 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 요청 필드 또는 구조화된 파서 출력이 검증에 실패했다. |
| 400 | `INVALID_TIME_WINDOW` | 종료 시간이 시작 시간보다 늦지 않다. |
| 400 | `UNSUPPORTED_AREA` / `AREA_REQUIRED` | 지역이 서울 MVP 범위를 벗어났거나 입력되지 않았다. |
| 400 | `INVALID_STOP_ACTION` | 경유지 수정 필드가 선택한 작업과 일치하지 않는다. |
| 404 | `TRIP_NOT_FOUND` | 요청한 여행이 존재하지 않는다. |
| 404 | `STOP_NOT_FOUND` | 경유지가 해당 여행에 속하지 않는다. |
| 422 | `NO_PLACE_CANDIDATES` | Provider가 기본 필터를 충족하는 서울 후보를 반환하지 않았다. |
| 422 | `NO_ROUTABLE_PLACE_CANDIDATES` | 후보는 있지만 검증된 좌표를 가진 후보가 없다. |
| 422 | `NO_FEASIBLE_ROUTE` | 후보는 있지만 확인된 필수 제약 조건을 만족하는 경로가 없다. |
| 422 | `EDIT_ROUTE_INFEASIBLE` | 제안된 삭제·순서 변경·재계산 결과가 제약 조건 안에서 모든 경유지를 유지할 수 없다. |
| 502 | `PROVIDER_RESPONSE_INVALID` | Live Provider 응답을 검증하거나 정규화할 수 없다. |
| 503 | `PROVIDER_UNAVAILABLE` | 설정된 Live Provider에 연결할 수 없다. |
| 500 | `INTERNAL_ERROR` | 예상하지 못한 백엔드 오류다. |

제공자 인증정보, 상위 서비스의 원본 오류 본문, 정제하지 않은 자연어 프롬프트는 오류 응답에 포함하지 않는다.
