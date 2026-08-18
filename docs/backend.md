# 백엔드

백엔드는 `backend/` 아래에 있는 단일 NestJS 11 애플리케이션이다. `/api` 하위 REST Endpoint를 제공하며 전역 요청 검증과 하나의 Exception Filter를 사용한다. Schema Synchronization을 비활성화한 TypeORM으로 데이터를 영속화한다.

## 모듈

- `PreferencesModule`: 요청을 `TripPreference`로 Parsing하고 JSON Schema를 검증한다.
- `ProvidersModule`: Live/Mock 장소 및 지역 혼잡도 Adapter와 Process 내부 TTL Cache를 제공한다.
- `RecommendationModule`: 결정론적 후보 점수 계산과 경로 Heuristic을 담당한다.
- `TripsModule`: 일정 생성 Orchestration, 영속화, 조회, 경유지 수정을 담당한다.
- `ReceiptsModule`: Phase 2 Entity, 민감정보 제거, Mock 추출, 후보 매칭을 제공하며 HTTP Workflow는 없다.
- `HealthModule`: Process, Database, Provider 모드 상태를 응답한다.
- `DatabaseModule`: PostgreSQL 연결과 Entity 등록을 담당한다.

## 일정 생성 처리 흐름

현재 `TripsService.generate`는 다음 작업을 수행한다.

1. 취향을 Parsing하고 검증한다.
2. 서울 지역 입력을 필수로 확인하고 여행 날짜를 결정한다.
3. `generating` 상태의 `Trip`을 만들고 `TripPreference`를 저장한다.
4. 검색어를 최대 세 개 생성해 선택된 장소 Adapter에 질의한다.
5. 후보의 중복을 제거하고 정규화한 뒤 `Place` Row를 Upsert한다.
6. 지역 혼잡도 관측값 하나를 가져온다.
7. 후보 순위를 계산하고 경로를 구성한다.
8. 추천 결과, 후보별 점수, 혼잡도 Snapshot, 여행 경유지를 저장한다.
9. 여행 상태를 `ready`로 바꾸고 응답 Envelope를 반환한다.

여행 생성 후 오류가 발생하면 여행 상태를 `failed`로 표시한다. 현재 각 쓰기 작업은 일정 생성 전체를 묶는 하나의 Database Transaction이 아니라 별도의 Repository 작업이다. 따라서 중간에 실패하면 실패한 여행과 연결된 Audit Row가 남을 수 있으며, 원자적 일정 생성은 기술 부채다.

## 검증과 오류

전역 `ValidationPipe`는 DTO Field를 변환하며, 허용되지 않은 값을 조용히 제거하지 않는다(`forbidNonWhitelisted: true`). 오류가 있으면 Field별 상세 정보와 함께 `VALIDATION_ERROR`를 반환한다. Preference Parser의 출력은 AJV와 `additionalProperties: false` JSON Schema로 다시 검증한다.

API 예외 필터는 Nest 오류를 정규화해 반환한다. Live 어댑터 실패 시 오류 코드와 상태는 공개하지만 인증정보는 반환하지 않는다. 제공자의 원본 오류 본문도 전달하지 않는다.

## 외부 데이터

- NAVER Local Search는 `PlaceProvider` 뒤에 구현되어 있다.
- 서울 실시간 인구·혼잡도 데이터는 `CrowdProvider` 뒤에 구현되어 있다.
- 두 Provider 모두 결정론적 Mock 구현을 제공한다.
- Cache는 Process 내부 Memory에 있으며 Redis나 영속 Cache가 아니다.
- Provider에 없는 Field는 `null`로 유지한다. Normalizer는 가격, 이미지, 영업시간, 전화번호를 만들어내지 않는다.

Provider별 동작은 [external-data.md](external-data.md)를 참고한다.

## 수정 동작

`PATCH /api/trips/:id/stops`는 `remove`, `reorder`, `recalculate` 중 하나를 받는다.

- Remove는 경유지를 삭제하고 남은 경유지의 순서를 다시 지정한다.
- Reorder는 현재 모든 경유지 UUID를 정확히 한 번씩 요구하며, Transaction 안에서 `order`를 갱신한다.
- Recalculate는 현재 경유지 집합으로 Route Optimizer를 다시 실행하고, Transaction 안에서 순서와 시간을 갱신한다.

세 수정 Action은 모두 제안된 순서를 유지하면서 이동·방문 시간을 다시 계산한다. 제안된 모든 경유지를 일정에 배치할 수 없으면 수정을 거부한다. 수정에 성공하면 하나의 Transaction에서 경유지 시간과 여행의 `modified` 상태를 갱신한다.

## 알려진 백엔드 미완성 항목

- OpenAI Live 취향 Parsing은 구현했지만 로컬 QA에서 Credential을 사용한 검증은 하지 않았다.
- 현재 장소 Adapter에서는 영업시간, Provider 비용, 장소 이미지, 길찾기, 장소 단위 혼잡도를 제공하지 않는다.
- 시간·예산 점수 계산과 검증은 확인된 값을 지원하지만, Provider 데이터가 없어 일반적으로 명시적인 알 수 없음·중립 정책을 사용한다.
- 식사·카테고리 처리는 결정론적 Heuristic이다. Provider 예약 데이터나 사용자가 요청한 카테고리를 반드시 충족하는 기능은 없다.
- `UserEvent`는 Schema/Entity로만 존재하며 Michi Ingestion API나 영속 이벤트 Pipeline은 없다.
- 영수증 업로드, 원본 이미지 처리, Live OCR/Vision, 영속화 Orchestration, 사용자 확인 UI, 추천 평가는 구현하지 않았다.
