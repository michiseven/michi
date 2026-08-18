# AI와 취향 분석

백엔드는 `TripPreferenceParser` Port를 정의하며, `LLM_PROVIDER_MODE`에 따라 두 구현 중 하나를 선택한다. Live 모드에서는 `OpenAIProvider`, Credential 없는 개발 환경에서는 `MockTripPreferenceParser`를 사용한다. 두 구현의 결과 모두 추천을 시작하기 전에 서버가 소유한 검증 절차를 통과한다.

## Live OpenAI 분석기

`OpenAIProvider`는 사용자 요청 전체에 대해 Responses API Structured Output 호출을 한 번 수행한다. 모델은 `OPENAI_MODEL`에서 읽으며, 프로젝트 요구사항에 따라 기본값은 `gpt-5.6-luna`다. Provider와 맞닿는 Schema는 Zod로 정의하고 OpenAI Helper가 Structured Output 형식으로 변환한다.

System Instruction은 추출 범위를 서울 여행 제약조건으로 제한하고, 장소 추천·순위 계산·생성을 명시적으로 금지한다. Live 결과에는 표준 area/time/budget/companion/pace/interest/preference/avoid Field만 포함할 수 있다. 요청에 명시된 `startArea`, `startTime`, `endTime`, `budget` Field는 Parsing 결과를 덮어쓴다.

Structured Output이 없으면 Adapter는 Provider 응답 오류를 반환한다. 그 밖의 OpenAI 실패는 `PROVIDER_UNAVAILABLE`로 변환하며, 조용히 Mock 데이터로 전환하지 않는다.

## Mock 분석기

Mock Parser는 다음 항목에 결정론적 일본어·한국어 Keyword 규칙을 사용한다.

- 성수 또는 홍대 지역 인식
- 카페, 편집숍·쇼핑, 고기, 공원 관심사
- 혼자 여행과 여유로운 속도
- 조용한 장소 선호와 일반·강한 혼잡 회피
- `HH:mm` 및 일본어 시간 범위
- 정수·소수 `万ウォン`과 일반 원화 예산
- 시간이 없을 때 `13:00`부터 `21:00`까지의 기본값

`parserMode: "mock"`과 함께 OpenAI 결과가 아니라는 경고를 반환한다.

## 서버 검증과 서울 범위

그다음 AJV가 `additionalProperties: false` JSON Schema, 유효한 당일 `HH:mm` 값, 제한된 문자열·배열 크기, 중복 없는 Tag, 0원부터 10,000,000원까지의 정수 예산 또는 null을 강제한다. `PreferencesService`는 종료 시간이 시작 시간보다 늦지 않으면 거부한다.

`normalizeSeoulArea`는 제한된 Alias 목록을 사용해 `聖水` 같은 값을 `성수`로 변환한다. 알려진 서울 외 도시와 한국어 지역명이 없는 입력은 거부하고, 그 밖의 한국어 서울 지역 문자열은 그대로 둔다. 이는 기본적인 MVP 보호 장치이며 완전한 행정구역·Geocoding 검증은 아니다.

## LLM 경계

현재 LLM 연동은 자연어를 `TripPreference`로 Parsing하는 데만 사용한다. 설명 생성 호출은 구현하지 않았다. 장소, 좌표, 가격, 영업시간, 혼잡도, 거리, 후보 점수, 경로는 계속 Provider와 애플리케이션의 책임이다. 요청당 Parsing 호출은 한 번이며 후보 반복문 안에서는 LLM을 호출하지 않는다.

Live 동작은 코드에 구현되어 있지만 로컬 QA에서 Credential로 검증하지 않았다. 기본값은 계속 Mock 모드다.
