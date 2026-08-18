<!-- BEGIN:nextjs-agent-rules -->

# 기존에 알고 있던 Next.js와 다를 수 있음

이 버전에는 호환성을 깨는 변경이 포함되어 있어 API, 규칙, 파일 구조가 학습 데이터와 다를 수 있다. 코드를 작성하기 전에 `node_modules/next/dist/docs/`의 관련 가이드를 읽는다. 경로는 이 파일의 디렉터리를 기준으로 해석하며, 모노레포에서는 저장소 루트에서 `next` 패키지가 보이지 않을 수 있다. 사용 중단 안내도 반드시 따른다.

자동 생성 규칙은 한국어 문서를 덮어쓰지 않도록 `next.config.ts`에서 비활성화했다. Next.js 동작이 불확실하면 현재 설치본의 `node_modules/next/dist/docs/`를 기준으로 확인한다.

<!-- END:nextjs-agent-rules -->
