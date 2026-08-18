# 테스트와 검증

## 명령어

저장소 루트에서 다음 명령을 실행합니다.

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

데이터베이스와 API 통합 검증에는 다음 명령도 필요합니다.

```bash
docker compose up -d db
npm --prefix backend run migration:run
npm --prefix backend run seed
curl http://localhost:4000/api/health
```

## 프런트엔드 테스트 범위

현재 Vitest, React Testing Library, `user-event`는 다음 동작을 검증합니다.

- 명시적인 기본 제약조건을 포함한 planner 제출
- 필드별 시간 범위 validation 동작
- 추천 이유, 점수 상세, 지역 혼잡도 안내, Mock provider 모드 표시
- 사용자 입력을 보존한 상태에서의 backend 오류 처리
- stop 삭제 요청과 갱신된 화면 표시
- stop 순서 변경 요청

Frontend 테스트는 API 모듈을 Mock 처리합니다. 실제 backend 통신 응답, NAVER Maps 스크립트 동작, 여행 상세 조회 실패, 재계산, 빈 경로, 모바일 레이아웃, 실제 브라우저의 키보드 탐색 순서는 검증하지 않습니다.

## 백엔드 테스트 범위

백엔드 Jest 테스트 모음은 환경변수 검증, DTO·스키마 검증, Mock 및 OpenAI 선호도 분석과 명시적 값 우선 적용, 서울 지역명 정규화, 장소 정규화, Live/Mock 어댑터 계약, 결정론적 순위 계산, 동적 가중치, 점수 내역, 경로 생성·제약조건, 응답 직렬화, 여행 편집 처리 흐름, OCR 민감정보 제거, Mock 영수증 추출, 결정론적 영수증-장소 후보 생성을 검증합니다.

## Log Friends SDK 테스트 범위

Vitest는 identity/allowlist/context validation, endpoint가 비활성화된 상태의 queue 동작, batching, 실패 보존/retry, fetch transport contract를 검증합니다. Frontend 테스트는 endpoint가 없을 때 네트워크 요청이 발생하지 않는지, 발생한 이벤트 context에 자연어 요청이 포함되지 않는지를 검증합니다.

## QA 검증 항목

최종 QA에서는 다음 항목을 확인해야 합니다.

- API stop 필드가 frontend의 기대와 동일하게 `latitude`/`longitude`, `HH:mm` 일정 값, `crowd.level`, `providerModes.llm`을 사용하는지
- mock/live 모드와 warning이 명확하게 유지되는지
- 실제로 생성된 여행을 다시 조회하고 수정할 수 있는지
- 빈 PostGIS 데이터베이스에 migration을 적용할 수 있고 기본 seed가 아무 작업도 하지 않는지
- 문서가 구현된 OpenAI/Log Friends/영수증 기반 구조와 미검증 live credential, 누락된 ingest/upload workflow, 지원하지 않는 제약조건을 명확히 구분하는지

최종 검증에서 frontend lint, frontend 테스트 10개 전체, frontend production build, SDK lint/테스트 5개 전체/build, backend lint/테스트 34개 전체/build, Compose validation, 데이터베이스 migration 2개, PostGIS 3.5 연결, seed, Mock API 생성/reorder smoke test가 모두 통과했습니다. SDK `dist`/`node_modules`가 없는 임시 새 복사본에서도 frontend pre-script가 로컬 SDK를 컴파일하므로 frontend `npm ci`와 build가 완료되었습니다. 정확한 상태는 [current-status.md](current-status.md)를 참고하세요.

브라우저 runtime 초기화 실패로 인앱 브라우저 검증은 실행하지 못했습니다. 따라서 접근성 검토는 렌더링된 desktop/mobile 세션 대신 component, CSS, DOM 중심 테스트를 기반으로 진행했습니다. 소스 검토에서는 표시되는 label/focus style, 필드별 validation 연결, 44px control, reduced-motion 처리, loading/error/empty 상태, 접근 가능한 이름을 확인했습니다.
