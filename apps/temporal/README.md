# Temporal Workflow Engine (`temporal`)

Triển khai nền tảng **Temporal Server v1.32.1** cùng **Temporal Web UI** trên cụm RKE2 qua GitOps ArgoCD.

---

## 1. Thông tin triển khai

| Môi trường | Namespace | URL Web UI | gRPC Endpoint (Nội bộ) | Storage (DB) |
|------------|-----------|------------|------------------------|--------------|
| **Dev** | `temporal-dev` | `https://dev-temporal.192.168.250.215.nip.io` | `temporal-frontend.temporal-dev.svc.cluster.local:7233` | 10Gi (`local-path`) |

- **Web UI URL dự phòng**: `https://dev-temporal.192.168.250.215.sslip.io`
- **Temporal Server Image**: `temporalio/auto-setup:1.32.1`
- **Temporal Web UI Image**: `temporalio/ui:2.34.0`
- **Database**: PostgreSQL 15 (`postgres:15-alpine` StatefulSet với 2 database: `temporal` và `temporal_visibility`)
- **Default Namespace**: `default` (tự động khởi tạo khi boot)

---

## 2. Kiến trúc & Thành phần

1. **Temporal PostgreSQL DB**:
   - Chạy StatefulSet `temporal-postgresql` với PVC 10Gi gắn vào StorageClass `local-path` trên openSUSE Leap Micro (an toàn với Btrfs).
   - Tự động chạy script `/docker-entrypoint-initdb.d/01-init-visibility.sh` để tạo database `temporal_visibility` bên cạnh `temporal`.

2. **Temporal Server**:
   - Sử dụng image `temporalio/auto-setup:1.32.1`.
   - Tự động chạy `temporal-sql-tool` để khởi tạo schema cho database chính và visibility database.
   - Chạy đầy đủ các role: Frontend (gRPC: 7233), History (6934), Matching (6935), Worker (6939).
   - Expose Prometheus metrics tại port 9090.

3. **Temporal Web UI**:
   - Giao diện trực quan theo dõi Workflows, Activity Executions, Schedules và Namespaces tại port 8080.
   - Kết nối trực tiếp vào service nội bộ `temporal-frontend:7233`.

4. **Ingress & TLS**:
   - Ingress Controller: Traefik (`ingressClassName: traefik`).
   - Tự động cấp phát chứng chỉ TLS qua cert-manager `local-ca-issuer`.

---

## 3. Cách kết nối từ ứng dụng (Client / Worker)

Từ các ứng dụng chạy trong cụm Kubernetes (ví dụ: ứng dụng Go, Python, TypeScript, Java):

```bash
TEMPORAL_ADDRESS="temporal-frontend.temporal-dev.svc.cluster.local:7233"
# hoặc trong cùng namespace temporal-dev:
TEMPORAL_ADDRESS="temporal:7233"
TEMPORAL_NAMESPACE="default"
```

---

## 4. Đồng bộ GitOps

ArgoCD ApplicationSet `tenant-applications` tại `bootstrap/applicationset.yaml` tự động quét các thư mục con `apps/*/overlays/*`. Do đó, khi commit và push `apps/temporal/overlays/dev`:

1. ArgoCD tự động tạo Application `temporal-dev`.
2. Tạo namespace `temporal-dev`.
3. Triển khai PostgreSQL, chạy auto-setup Temporal v1.32.1, Temporal UI và Ingress.
