# 외부 데이터

모든 외부 접근은 환경변수 모드로 선택되는 provider interface 뒤에 분리되어 있습니다. Live 호출이 실패해도 조용히 Mock fixture로 대체하지 않습니다.

## NAVER 지역 검색

`NaverPlaceProvider`는 client ID/secret header, 5초 timeout, 1~5 범위의 결과 제한, process 내부 TTL cache를 적용해 설정된 NAVER Local Search endpoint를 호출합니다. Query는 `<area> <generated search term>` 형식을 사용합니다.

`normalizeNaverLocalItem`은 다음을 수행합니다.

- title이 없는 item 거부
- address/road address가 서울(`서울`)로 시작하지 않는 record 거부
- title의 기본 HTML markup 제거
- NAVER 정수형 지도 좌표를 10,000,000으로 나눈 뒤 전역 범위 검증
- 알려진 raw category의 마지막 항목을 `cafe`, `restaurant`, `shopping`, `park`, `culture` 중 하나로 mapping
- address token 중 `구`로 끝나는 값에서 district 추출
- raw item과 identity가 provider 제공 값인지 파생 값인지 여부 보존

Link가 제공되지 않으면 adapter는 provider field로부터 결정론적인 SHA-256 identity를 생성합니다. 이 값은 raw metadata에서 파생 ID임을 명시하며 NAVER의 공식 place ID로 표현하지 않습니다.

NAVER 지역 검색의 현재 표준 계약에서는 검증된 가격, 영업시간, 이미지를 제공하지 않습니다. 해당 필드를 추측해서 채우지 않습니다.

## 서울 열린데이터광장 혼잡도 맥락

`SeoulCrowdProvider`는 요청한 지역에 대해 `citydata_ppltn`을 5초 timeout으로 호출하고 결과를 cache에 저장합니다. 반환된 지역명/code, 혼잡도 level/message, 인구 관측 시각을 읽습니다.

관측값의 `scope`는 `"area"`입니다. 예를 들어 성수역 일대 관측값은 특정 카페 내부의 혼잡도가 아닙니다. 이 안내는 각 trip-stop crowd snapshot에 저장되며 frontend에서도 같은 구분을 표시합니다.

Credential이 포함된 요청 URL은 HTTP 요청에만 사용합니다. 저장되는 `sourceUrl`에는 공개 OA-21285 dataset page를 사용하므로 서울 API key가 `ExternalDataSnapshot`에 저장되지 않습니다.

## Mock 제공자

- `MockPlaceProvider`는 이름이 `[MOCK]`으로 시작하는 결정론적 합성 서울 fixture를 반환합니다. Raw payload에는 `fixture: true`와 `synthetic: true`가 포함됩니다.
- `MockCrowdProvider`는 명시적인 합성 metadata와 안내 문구를 포함한 지역 범위의 `MOCK_NORMAL` 관측값을 반환합니다.
- API provider 모드와 warning에서 두 Mock provider 사용 여부를 모두 밝힙니다.
- Database seed는 `SEED_MOCK_DATA=true`인 경우에만 데이터를 추가합니다. 활성화하면 합성 장소 하나에 `[MOCK]` label이 명확하게 표시됩니다.

## 일본 시장 데이터

`JapaneseMarketMetric`과 migration에는 source, source URL, publication/collection time, segment, metric, value, sample size, notes가 정의되어 있습니다. JTB, JATA, e-Stat 또는 기타 설문 importer와 metric seed는 구현하지 않았습니다. 현재 이 행들은 선호도 분석이나 scoring에서 사용하지 않습니다.

향후 사용할 때도 다음 우선순위를 유지해야 합니다.

```text
direct user input > observed behavior > aggregate market prior
```

출처를 확인할 수 없는 metric은 저장하지 않습니다.

## 영수증 추출 기반 구조

`ReceiptExtractor`도 adapter 경계로 분리되어 있지만 현재는 `MockReceiptExtractor`만 존재합니다. Redaction되지 않은 OCR text 대신 `redactSensitiveOcr`의 branded output을 입력으로 받고, 명시적으로 합성된 merchant/item fixture를 반환합니다. Live OCR/Vision adapter, upload endpoint, 외부 영수증 호출은 없습니다.

`DeterministicReceiptPlaceMatcher`는 정규화한 merchant/place name의 character-bigram Dice similarity를 비교하고, 필요한 경우 address-token Jaccard similarity를 더합니다. Confidence와 `requiresUserConfirmation: true`를 포함한 정렬된 후보를 반환하며, 장소를 생성하거나 방문 사실을 단정하지 않습니다.

## 캐시 경계

`TtlCache`는 단일 backend process 내부에서만 공유되는 in-memory map입니다. 로컬/MVP 환경에서 요청 횟수를 줄이기에는 적합하지만 durability, instance 간 coordination, distributed invalidation은 제공하지 않습니다.
