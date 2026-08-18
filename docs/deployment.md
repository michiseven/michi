# NAS Kubernetes 배포

## 현재 구조

Michi는 기존 Log Friends와 같은 MicroK8s Ingress와 도메인을 사용하되 경로로 완전히 분리한다.

```text
choi1994.tplinkdns.com/michi
  -> michi-frontend:3000

choi1994.tplinkdns.com/michi/api
  -> michi-backend:4000
  -> 기존 PostgreSQL 서버의 michi 데이터베이스
```

Kubernetes에는 PostgreSQL을 새로 배포하지 않는다. 기존 PostgreSQL 계정으로 독립된 `michi` 데이터베이스만 사용한다. 실제 `DATABASE_URL`은 Git에 포함하지 않고 `michi-runtime` Secret으로 주입한다.

## 이미지 빌드

NAS 노드는 `linux/amd64`이므로 Apple Silicon Mac에서도 플랫폼을 명시한다.

```bash
docker buildx build --platform linux/amd64 --load \
  -f backend/Dockerfile -t michi-backend:0.1.0 .

docker buildx build --platform linux/amd64 --load \
  -f frontend/Dockerfile -t michi-frontend:0.1.0 .
```

Frontend 이미지는 빌드 시 다음 운영값을 기본 적용한다.

```text
NEXT_PUBLIC_BASE_PATH=/michi
NEXT_PUBLIC_API_URL=/michi/api
NEXT_PUBLIC_DEMO_MODE=false
```

## MicroK8s 이미지 반입

현재 배포는 외부 container registry를 사용하지 않는다. 이미지를 NAS의 MicroK8s containerd로 직접 반입한다.

```bash
docker save michi-backend:0.1.0 | ssh <nas-user>@<nas-host> \
  '/usr/bin/ctr --address /var/snap/microk8s/common/run/containerd.sock --namespace k8s.io images import -'

docker save michi-frontend:0.1.0 | ssh <nas-user>@<nas-host> \
  '/usr/bin/ctr --address /var/snap/microk8s/common/run/containerd.sock --namespace k8s.io images import -'
```

## Secret과 리소스 적용

먼저 PostgreSQL에 `michi` 데이터베이스를 생성한다. 그 다음 실제 접속 문자열을 shell history와 저장소에 남기지 않는 방식으로 Secret에 등록한다. 아래 값은 자리표시자이며 실제 인증정보가 아니다.

```bash
microk8s kubectl create namespace michi --dry-run=client -o yaml \
  | microk8s kubectl apply -f -

microk8s kubectl -n michi create secret generic michi-runtime \
  --from-literal=DATABASE_URL='<postgresql-connection-string>' \
  --dry-run=client -o yaml | microk8s kubectl apply -f -

microk8s kubectl apply -f deploy/kubernetes.yaml
```

Backend Pod의 init container는 `migration:run:prod`를 실행한 뒤 애플리케이션을 시작한다. Migration은 반복 실행해도 이미 적용된 항목을 다시 적용하지 않는다.

## 확인

```bash
microk8s kubectl -n michi rollout status deployment/michi-backend
microk8s kubectl -n michi rollout status deployment/michi-frontend
microk8s kubectl -n michi get pods,svc,ingress

curl -f http://choi1994.tplinkdns.com/michi
curl -f http://choi1994.tplinkdns.com/michi/api/health
```

배포 후 기존 Log Friends의 `/`, `/examples`, `/api`, `/ingest`, `/actuator` 경로도 함께 확인한다. Michi Ingress는 `/michi`와 `/michi/api`만 소유하며 기존 Ingress manifest를 수정하지 않는다.

## 현재 제한

- TLS와 인증은 아직 구성하지 않았다.
- NAVER, 서울 열린데이터광장, OpenAI credential을 주입하지 않아 세 Provider 모두 Mock 모드다.
- NAVER Maps client id가 없어 frontend는 지도 대체 화면을 사용한다.
- 이미지는 NAS 로컬 containerd에만 있으므로 노드 교체 시 다시 반입해야 한다.
