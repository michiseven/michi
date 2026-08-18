# 개인정보 보호와 데이터 처리

현재 Michi에는 계정 시스템과 영수증 upload 기능이 없습니다. 다만 핵심 요청에는 사용자가 작성한 자유 형식 text가 포함되며, 서비스가 개인정보를 요구하지 않더라도 사용자가 개인정보를 입력할 수 있습니다.

## 현재 저장되는 데이터

- `TripPreference.originalText`: 자연어 요청 전문
- `TripPreference.validatedJson`: 구조화된 지역, 시간, 예산, 동행/속도, 관심사, 선호, 회피 값
- 여행 일정과 추천 audit record
- 원본 장소 및 지역 혼잡도 provider payload
- 외부 출처 metadata

저장소에는 `UserEvent`가 정의되어 있지만 event ingest endpoint나 영속적인 이벤트 저장 workflow는 활성화되어 있지 않습니다. 일본 시장 metric 저장 구조는 존재하지만 importer나 seed source data는 없습니다.

## 비밀정보 관리

- Credential 환경변수는 `.env.example`에 빈 값으로 기재되어 있습니다.
- Provider credential은 backend에만 유지됩니다. NAVER Maps browser client ID만 설계상 공개 값입니다.
- QA 시점의 추적 대상 프로젝트 소스 secret scan에서 입력된 API key나 private key는 발견되지 않았습니다.
- `.env`와 생성된 build/의존성 directory는 `.gitignore`에서 제외됩니다.

`SeoulCrowdProvider`는 credential이 포함된 요청 URL과 출처로 저장되는 공개 dataset URL을 분리합니다. Key는 adapter 결과에 반환되지 않으며 `sourceUrl`에도 저장되지 않습니다.

## 보존과 최소화의 미구현 항목

보존/삭제 job, 사용자 삭제 API, 암호화 정책, 접근 제어 계층은 구현되지 않았습니다. Production 적용 전 다음 작업이 필요합니다.

- 원본 자유 형식 text와 provider raw payload의 보존 기간 정의
- debugging/audit에 불필요한 raw field 최소화 또는 redaction
- request body와 credential을 포함한 upstream URL의 logging 방지
- event ingest 활성화 전 context payload 크기와 key 제한
- database 및 backup 접근 정책 문서화

## 2단계 이벤트 보호 장치

Log Friends SDK는 제품 이벤트 8개만 허용 목록으로 관리하며, 짧은 원시 값과 배열로 구성된 평면적인 문맥만 받습니다. 인증 헤더, 쿠키, 이메일, 이름, 비밀번호, 전화번호, 요청 본문, 비밀정보, 토큰 등 민감정보로 보이는 키는 거부합니다. 세션·여행·장소 ID는 길이가 제한된 불투명 식별자여야 합니다. 프런트엔드는 ID와 논리값·개수·순서·제공자 모드만 전송하며 사용자의 요청 본문은 보내지 않습니다.

Endpoint가 없으면 네트워크 호출도 발생하지 않습니다. 명시적인 endpoint를 설정하면 fetch transport는 `credentials: "omit"`을 사용하고 크기가 제한된 batch를 전송하며, 실패한 이벤트는 retry를 위해 보존합니다. 익명의 무작위 session ID 범위는 `sessionStorage`로 제한됩니다. Cookie, account identity, DOM scraping, 자동 browser/request capture는 사용하지 않습니다.

## 2단계 영수증 보호 장치

`redactSensitiveOcr`는 extractor가 문서를 받기 전에 일반적인 한국/일본 전화번호와 카드 형식, 이름 label, bearer/JWT/OpenAI key, label이 붙은 credential을 제거합니다. Mock extractor는 redaction 완료를 나타내는 branded document type만 받으며 명시적으로 합성된 field를 반환합니다. Schema에는 raw OCR/image나 민감한 결제 정보 column이 없습니다.

정규식 redactor는 기본적인 방어 수단일 뿐 모든 PII가 제거되었다는 증명은 아닙니다. Production pipeline에는 upload 제한, image lifecycle/deletion, 강화된 탐지, access control, audit/retention 정책, live OCR adapter가 추가로 필요합니다. Match 결과는 confidence와 `requiresUserConfirmation`을 포함한 후보로 유지됩니다. 사용자가 확인한 match만 `Visit` 행이 될 수 있습니다.
