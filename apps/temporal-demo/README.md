# Temporal TypeScript Demo Application (`temporal-demo`)

Ứng dụng mẫu minh họa sức mạnh của **Temporal TypeScript SDK** thông qua bài toán thực tế: **E-Commerce Order Fulfillment, Saga Compensation & Human-in-the-Loop Approval**.

---

## 1. Thông tin triển khai

| Môi trường | Namespace | URL Web UI | Temporal Cluster |
|------------|-----------|------------|------------------|
| **Dev** | `temporal-demo-dev` | `https://dev-temporal-demo.192.168.250.215.nip.io` | `temporal-frontend.temporal-dev.svc.cluster.local:7233` |

- **URL dự phòng**: `https://dev-temporal-demo.192.168.250.215.sslip.io`
- **Dashboard quản trị Temporal**: `https://dev-temporal.192.168.250.215.nip.io`

---

## 2. Kiến trúc & Các khái niệm Temporal trong Demo

1. **Workflow (`src/workflows.ts`)**:
   - `orderFulfillmentWorkflow`: Điều phối toàn bộ vòng đời đơn hàng.
   - Viết bằng code TypeScript thuần, nhưng được Temporal đảm bảo tính **bền vững (Durable Execution)**: nếu server khởi động lại giữa chừng, workflow vẫn tiếp tục đúng tại bước đang chạy mà không bị mất dữ liệu.
   
2. **Activities (`src/activities.ts`)**:
   - `processPayment`: Gọi cổng thanh toán (tự động retry nếu lỗi mạng).
   - `reserveInventory`: Khóa hàng trong kho.
   - `dispatchShipping`: Giao đơn vị vận chuyển.
   - `refundPayment`: **Saga Compensation Activity** — tự động hoàn tiền nếu các bước sau gặp sự cố hoặc khách hủy đơn.

3. **Human-in-the-Loop & Signals**:
   - Workflow sử dụng `condition(() => state.approved || state.cancelled, '120s')` để tạm dừng chờ người dùng bấm **Duyệt** hoặc **Hủy** trên giao diện Web UI.
   - Khi bấm duyệt, Web UI gửi một **Temporal Signal** (`approveOrderSignal`) đánh thức Workflow ngay lập tức.

4. **Temporal Queries**:
   - Web UI liên tục thăm dò trạng thái bằng `getOrderStateQuery` để hiển thị tiến trình thời gian thực mà không cần viết polling database riêng.

---

## 3. Kiến trúc Microservices trong Kubernetes

- **Pod 1 (`temporal-demo-web`)**: Chạy Express Web & API Server, phục vụ giao diện người dùng và gửi lệnh tới Temporal Server qua `@temporalio/client`.
- **Pod 2 (`temporal-demo-worker`)**: Chạy Temporal Worker qua `@temporalio/worker`, lắng nghe hàng đợi `order-processing-queue` để thực thi Workflow và Activities.

---

## 4. Cách Build & Push Docker Image

```bash
./apps/temporal-demo/docker/build.sh
```
Script sẽ biên dịch cross-platform `linux/amd64` và đẩy image trực tiếp lên OCI Registry nội bộ `registry.192.168.250.215.sslip.io/temporal-demo:latest`.
