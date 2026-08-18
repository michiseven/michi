# AGENTS.md — Michi

## 제품 범위

Michi는 일본인 사용자를 위한 서울 여행 일정 서비스다. 자연어 취향을 검증된 제약조건으로 변환하고, 외부 제공자가 확인한 서울 POI만 조회하며, 후보 점수를 결정론적으로 계산해 설명 가능한 경로를 만든다.

- MVP는 서울만 지원한다.
- 소셜, 피드, 숏폼, 채팅, 광고, 전국 단위 기능을 만들지 않는다.
- LLM이 장소, 가격, 좌표, 영업시간, 혼잡도, 순위, 경로를 만들어내게 하지 않는다.
- 지역 단위 혼잡 데이터는 지역 맥락으로만 취급하고 특정 장소의 내부 혼잡도로 간주하지 않는다.
- 사용자 직접 입력, 행동 데이터, 일본 시장 Cold Start Prior 순으로 우선한다.
- 외부 데이터에 없는 값은 `null` 또는 미지정 상태로 두고 추론하지 않는다.

## 저장소 구조

- `frontend/`: Next.js 기반 일본어 모바일 우선 UI
- `backend/`: NestJS REST API, TypeORM, PostgreSQL/PostGIS, 어댑터, 추천 파이프라인
- `packages/log-friends-sdk/`: Core MVP 검증 이후 추가한 Phase 2 TypeScript 이벤트 SDK
- `docs/`: 계획이 아닌 실제 구현 시스템을 설명하는 문서

## 공통 계약

- API JSON은 camelCase를 사용한다.
- 시각 값은 `HH:mm`, 타임스탬프는 ISO 8601을 사용한다.
- 금액은 정수 KRW로 표현한다.
- 좌표는 WGS84 위도·경도를 사용한다.
- 모든 추천 경유지는 `reason`과 `scoreBreakdown`을 포함한다.
- API 메타데이터와 UI에 제공자 모드(`mock` 또는 `live`)를 명시한다.
- 프런트엔드는 `NEXT_PUBLIC_API_URL`을 통해 백엔드를 호출한다.

## 개발 규칙

- TypeScript strict 모드를 사용한다.
- 외부 API는 작은 인터페이스 뒤에 두고 Live와 Mock 구현을 분리한다.
- Mock fixture를 눈에 띄게 표시하며 실제 데이터라고 설명하지 않는다.
- 환경변수 입력과 요청 payload를 검증한다.
- 점수, 경로, 정규화, 스키마를 변경할 때 테스트를 추가한다.
- 같은 입력과 fixture에는 결정론적인 추천 결과를 유지한다.
- Secret을 소스 제어에 포함하지 않는다.
- 구현 변경 후 문서를 갱신하고, 미완성 작업은 `docs/current-status.md`에 정확히 기록한다.

## 필수 검증

```bash
docker compose config
npm --prefix backend run lint
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```
