# 프런트엔드

프런트엔드는 `frontend/`에 있는 일본어 우선 Next.js 16 App Router 애플리케이션이다. React 19, Strict TypeScript, CSS 빌드 계층으로 Tailwind CSS 4를 사용하며, 프로젝트 고유의 Semantic Style은 `src/app/globals.css`에 정의한다.

## 구현된 흐름

`/`는 여행 Planner를 표시한다. 필수 자연어 입력과 함께 날짜, 시작/종료 시간, 원화 예산, 출발 지역을 선택적으로 입력할 수 있다. 제출하면 검증된 `{ text, travelDate?, startTime?, endTime?, budget?, startArea? }` Contract를 `POST /api/trips/generate`로 전송한다.

결과 화면에는 다음 정보가 표시된다.

- 각 Provider의 명확한 Live/Mock 상태와 모든 백엔드 경고
- 도착·출발 시간을 포함한 순서형 Timeline
- 장소 카테고리, Provider가 제공한 주소·사진, 체류 시간, 확인된 비용, 추천 이유, 점수 내역
- 특정 장소 내부 혼잡도가 아님을 알리는 경고가 포함된 지역 단위 혼잡도 정보
- 번호 Marker가 있는 NAVER 지도 또는 지도 ID를 사용할 수 없거나 로드에 실패했을 때 표시하는 명확한 좌표 Fallback

`/trips/[id]`는 `GET /api/trips/:id`에서 저장된 여행을 불러온다. 삭제, 순서 변경, 재계산 Control은 문서화된 `PATCH /api/trips/:id/stops` Action Union을 호출한다. 시간은 브라우저에서 다시 계산하지 않는다.

`/map-preview`는 추천 생성과 분리된 NAVER Maps 연결 확인 화면이다. 홈의 `地図の表示を確認` 버튼으로 이동하며, 서울의 명시적인 테스트 좌표와 Marker를 표시한다. 이 좌표는 추천 후보나 혼잡 데이터로 사용하지 않는다. Client ID가 없거나 인증·로딩에 실패하면 기존 지도 Fallback을 통해 원인을 구분할 수 있는 메시지를 표시한다.

## 모드와 설정

- `NEXT_PUBLIC_API_URL`은 API Base URL이다(`http://localhost:4000/api`).
- `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`를 설정하면 일본어 Label을 사용하는 NAVER Maps JavaScript Loader가 활성화된다.
- 프런트엔드 Fixture 응답은 `NEXT_PUBLIC_DEMO_MODE=true`로만 활성화할 수 있다. UI에는 지속적으로 `DEMO` 경고와 Mock Provider Chip이 표시된다. 값이 `false`이거나 생략된 경우 연결 오류는 그대로 오류로 남으며 Fixture 성공 응답으로 대체되지 않는다.

## 접근성과 반응형 동작

입력 요소에는 항상 Label이 표시된다. 자연어, 시간 범위, 예산 검증 메시지는 `aria-describedby`와 `aria-invalid`를 통해 관련 Control과 연결된다. 키보드 Focus는 눈에 보이고, Control은 최소 44px의 터치 영역을 가지며, 비동기 갱신에는 Live Region을 사용한다. 상태를 색상만으로 표현하지 않는다. 모바일에서는 한 열을 사용하고 760px 이상에서는 일정과 Sticky Map을 두 열로 배치한다. 움직임 감소 설정이 활성화되면 Transition과 Animation을 끈다.

Source/DOM Test로 이러한 상태를 검증했지만, QA 중 Browser Runtime 초기화에 실패해 실제 Desktop/Mobile Browser 화면 검증은 실행하지 못했다.

Design Token과 Component 규칙은 `design-system/Michi/MASTER.md`에 기록되어 있다.

## 2단계 텔레메트리

프런트엔드는 로컬 `@michi/log-friends-sdk` Package를 사용한다. `sessionStorage` 범위의 불투명한 무작위 Session ID를 만들고 `trip_requested`, `trip_generated`, `place_viewed`, 성공한 `place_removed`/`place_reordered`, 명시적인 `route_started`/`route_completed` Action을 전송한다. 요청 본문, DOM 내용, Cookie, Credential, 이름, 이메일, 전화번호는 수집하지 않는다. `place_added`는 SDK Contract에서 허용하지만 UI에 장소 추가 기능이 없어 전송하지 않는다.

네트워크 전송은 `NEXT_PUBLIC_LOG_FRIENDS_ENDPOINT`가 설정된 경우에만 활성화된다. 설정하지 않으면 이벤트는 크기가 제한된 In-memory Queue에 남으며 요청을 보내지 않는다. 이 저장소에는 백엔드 Ingestion Service가 없다.

## 검증

```bash
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```

Vitest와 React Testing Library로 Planner 제출 성공, 입력이 유지되는 API 실패, 경유지 삭제, 경유지 순서 변경, 표준 백엔드 응답 Envelope, API 오류 전파, Telemetry 안전성 및 비활성화 동작을 검증한다.
