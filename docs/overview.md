# 개요

Michi는 일본어를 기본 언어로 사용하며 서울만 지원하는 여행 일정 설계 서비스다. 사용자는 자연어로 원하는 하루를 설명하고 날짜, 시간 범위, 예산, 출발 지역을 추가할 수 있다. 백엔드는 입력을 검증하고 Provider Adapter를 통해 장소 후보를 가져온 뒤, 결정론적 애플리케이션 코드로 점수를 계산해 순서가 있는 경로를 만든다. 프런트엔드는 경로, Provider 모드, 제한 사항, 추천 이유, 항목별 점수를 보여준다.

## 현재 제품 흐름

```text
일본어 요청 + 명시적 제약조건
  -> POST /api/trips/generate
  -> 검증된 TripPreference
  -> 개수가 제한된 장소 검색어
  -> NAVER 지역 검색 또는 명확히 표시된 Mock 테스트 데이터
  -> 정규화된 서울 장소
  -> 서울 지역 혼잡도 어댑터 또는 명확히 표시된 Mock 관측값
  -> 결정론적 점수 계산과 동적 가중치
  -> Greedy 지리 경로 휴리스틱
  -> PostgreSQL/PostGIS 영속화
  -> 일본어 타임라인, 지도·대체 화면, 추천 이유, 점수 내역
```

프런트엔드는 `/trips/[id]`에서 저장된 여행을 불러오며, 백엔드를 통해 경유지를 삭제하거나 순서를 바꾸고 일정을 다시 계산할 수 있다. 브라우저 코드에서는 장소의 순위나 일정을 계산하지 않는다.

## 신뢰 경계

- 장소는 반드시 `PlaceProvider`에서 가져와야 하며, LLM이 장소를 생성할 수 없다.
- 가격, 영업시간, 이미지, 좌표, 혼잡도 정보가 없으면 추론해서 채우지 않는다.
- 혼잡도 관측값은 지역 단위 맥락이며, 특정 장소 내부의 혼잡도를 뜻하지 않는다.
- 모든 Mock 장소 이름에는 `[MOCK]` 접두사가 붙고, Mock 원본 Payload에는 합성 데이터임을 표시한다. API 경고와 Provider 모드에서도 Mock 사용 사실을 공개한다.
- 점수와 경로는 TypeScript 코드가 계산한다. 취향 파싱은 명시적인 Live 모드에서만 OpenAI Structured Output Adapter를 선택하며, 기본 결정론적 Mock Parser 사용 여부를 분명하게 알린다.

## MVP 범위

구현 범위는 서울 여행 계획으로 제한한다. 소셜 피드, 팔로우, 리뷰, 채팅, 광고, 커뮤니티 기능, 전국 여행 계획은 포함하지 않는다. Core 검증을 통과한 뒤 Phase 2에서 작은 Log Friends 이벤트 SDK와 프런트엔드 계측, 영수증 데이터·민감정보 제거·Mock 매칭 기반을 추가했다. 이벤트 수집 서비스, 영수증 업로드/OCR Endpoint, 영수증 영속화 Workflow, 추천 Feedback Loop는 아직 없다.

## 저장소 구성

- `frontend/`: Next.js 16, React 19, TypeScript, Tailwind 빌드 계층과 프로젝트 CSS.
- `backend/`: NestJS 11, TypeORM, PostgreSQL/PostGIS, Provider Adapter, 점수 계산, 경로 생성, REST API.
- `docs/`: 현재 소스 코드와 대조해 검토한 문서.
- `packages/log-friends-sdk/`: `identify`, `track`, `flush`, 허용 목록 이벤트, 개인정보 보호 장치를 제공하는 Phase 2 TypeScript SDK.

프로젝트 실행 방법은 [setup.md](setup.md), 검증된 현재 상태와 알려진 미완성 항목은 [current-status.md](current-status.md)를 참고한다.
