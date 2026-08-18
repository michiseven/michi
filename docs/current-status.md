# 현재 상태

이 문서는 계획된 범위가 아니라 검증된 구현 상태를 기록합니다. 아래 상태는 2026-08-18에 Mock provider 모드로 확인했습니다.

## 소스 코드에서 완료된 항목

- 일본어 기반 mobile-first planner, 생성된 여행 화면, 상세 경로, 명확한 provider 모드/warning, 지도 fallback, score breakdown, stop 편집 control
- NestJS REST 모듈, 입력 검증, TypeORM/PostGIS 엔티티와 마이그레이션 2개
- OpenAI 구조화 출력 선호도 분석기, 결정론적 Mock 분석기, 서버 JSON Schema 검증, 명시적인 제공자 모드
- live/mock interface 뒤에 분리된 NAVER Local Search 및 서울 지역 혼잡도 adapter
- Mock임이 명확하게 표시된 장소/혼잡도 fixture
- dynamic crowd/area weight와 적용된 weight 응답을 포함하는 결정론적 `deterministic-v2` score breakdown
- 독립적인 시간/순서/예산/확인 가능한 영업시간 validator를 갖춘 Haversine/greedy 기반 경로 heuristic
- 핵심 여행/추천/장소/혼잡도 persistence와 현재 stop 수정 기능. 성공적으로 생성된 여행은 `ready`, 수정된 여행은 `modified` 상태를 사용
- `identify`/`track`/`flush`, 8개 이벤트 allowlist, 크기가 제한된 안전한 context, 명시적 endpoint batch transport, retry queue, 구현된 frontend 동작의 instrumentation을 포함한 Phase 2 Log Friends SDK
- entity 3개와 migration, 민감한 OCR text redactor, 명시적인 합성 Mock extractor, 사용자 확인이 필요한 결정론적 장소 match 후보를 포함한 Phase 2 영수증 기반 구조

## 외부 API 상태

- NAVER 지역 검색: 코드 구현 완료. 이 저장소에서는 실제 인증정보 검증을 수행하지 않았으며 기본값은 MOCK입니다.
- 서울 열린데이터광장: 코드 구현 완료. 이 저장소에서는 실제 인증정보 검증을 수행하지 않았으며 기본값은 MOCK입니다. 저장되는 출처 정보에는 인증정보가 포함된 요청 URL 대신 공개 데이터셋 URL을 사용합니다.
- NAVER Maps: 클라이언트 로더와 대체 화면 구현 완료. QA에서 인증정보를 사용하지 않았습니다.
- OpenAI: live adapter 구현 완료. 이 저장소에서는 실제 credential 검증을 수행하지 않았으며 기본값은 MOCK입니다.
- 일본 시장 데이터 출처: schema만 존재하며 importer와 record는 없습니다.

## 미완성 또는 미착수 항목

- provider가 제공하는 실제 가격, 영업시간, 이미지, 길찾기, 장소 단위 혼잡도. Engine은 비용/영업시간 입력을 지원하지만 현재 adapter는 이를 제공하지 않습니다.
- 전역 최적 경로, provider 길찾기, 요청된 category 포함 여부를 보장하는 hard constraint
- 생성 작업 전체를 묶는 persistence transaction과 과거 recommendation version
- Log Friends 수집 endpoint, 서버 측 이벤트 검증·저장, 영속적 오프라인 브라우저 큐, `place_added` UI 동작
- 영수증 upload/image lifecycle, live OCR/Vision, persistence/controller workflow, 사용자 확인 UI, 추천 수용률 평가
- production authentication, authorization, retention/deletion, deployment

## 알려진 문제와 기술 부채

- Provider의 영업시간/비용을 알 수 없을 때 시간/예산 차원은 명시적인 중립값을 사용합니다.
- Frontend 테스트는 Mock fetch/module 경계를 사용하고 수동 API smoke test는 통과했지만, process 수준에서 자동화된 frontend/backend end-to-end 테스트가 여전히 필요합니다.
- 초기 검증에서는 브라우저 기반 desktop/mobile/accessibility QA를 수행할 수 없었습니다.
- 영수증 정규식 redaction은 테스트된 기본 방어 수단이며 모든 PII 형식을 제거한다고 보장하지 않습니다.

## 검증 결과

| 영역 | 결과 |
| --- | --- |
| Frontend lint | PASS |
| 프런트엔드 테스트 | PASS — 파일 4개, 테스트 10개 |
| 프런트엔드 빌드 | PASS |
| SDK 빌드 산출물이 없는 새 환경의 프런트엔드 설치·빌드 | PASS |
| Log Friends SDK lint | PASS |
| Log Friends SDK 테스트 | PASS — 파일 2개, 테스트 5개 |
| Log Friends SDK 빌드 | PASS |
| Backend lint | PASS |
| 백엔드 테스트 | PASS — 모음 14개, 테스트 34개 |
| 백엔드 빌드 | PASS |
| 운영 의존성 감사 | PASS — 프런트엔드·백엔드·SDK에서 보고된 취약점 0건 |
| Docker Compose 설정 | PASS — 호스트 `55432`에서 컨테이너 `5432`로 연결 |
| 데이터베이스 | PASS — 정상 상태의 PostgreSQL/PostGIS 3.5 연결 |
| 마이그레이션 | PASS — 초기 핵심 기능과 영수증 기반 마이그레이션 모두 적용, 대기 항목 없음 |
| 기본 seed | PASS — 추가한 행이 없으며 Mock seed 사용 방법을 명시함 |
| API smoke | PASS — health, preference parse, generation, retrieval, reorder/recalculation |

## 다음 구현 우선순위

자동화된 frontend/backend end-to-end contract 테스트를 추가합니다. 이후 영수증 upload/OCR/확인 workflow나 이벤트 ingest 서비스를 만들기 전에 live provider를 실제 credential로 검증합니다.
