# @michi/log-friends-sdk

Michi Phase 2용 최소 TypeScript 이벤트 SDK다. `identify()`, `track()`, `flush()`만 제공하며 브라우저 정보, DOM, 요청 본문, 개인정보, 쿠키 또는 인증정보를 자동 수집하지 않는다.

## 사용법

```ts
import { LogFriendsClient } from "@michi/log-friends-sdk";

const endpoint = process.env.NEXT_PUBLIC_LOG_FRIENDS_ENDPOINT;
// endpoint를 명시한 경우에만 네트워크 전송이 활성화된다.
const client = new LogFriendsClient(endpoint ? { endpoint } : {});

client.identify({ sessionId: crypto.randomUUID() });
client.track("trip_generated", {
  tripId: "trip-id",
  context: { stopCount: 4, providerMode: "mock" },
});
await client.flush();
```

허용 이벤트는 `trip_requested`, `trip_generated`, `place_viewed`, `place_removed`, `place_reordered`, `place_added`, `route_started`, `route_completed`뿐이다. `context`는 민감하지 않은 짧은 primitive 값과 그 배열만 허용하며, 민감 필드명은 런타임에서 거부한다.

endpoint를 생략하면 이벤트는 최대 200개까지 메모리 큐에만 남고 네트워크 요청은 발생하지 않는다. 전송 실패 시 실패한 batch와 이후 이벤트는 큐에 보존되어 다음 `flush()`에서 재시도된다. 영구 저장, 페이지 종료 beacon, 사용자 식별, 이벤트 수집 서버는 이 패키지의 범위가 아니다.

```bash
npm install
npm run lint
npm test
npm run build
```
