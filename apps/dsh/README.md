# DeepSeek Harness Web (`dsh`)

Ứng dụng AI Coding Agent & Automation Harness chính thức từ DeepSeek AI (`@deepseek-ai/dsh`) triển khai trên cụm RKE2 qua GitOps ArgoCD.

---

## 1. Thông tin triển khai

| Môi trường | Namespace | URL truy cập | TLS Issuer | Storage |
|------------|-----------|--------------|------------|---------|
| **Dev** | `dsh-dev` | `https://dev-dsh.192.168.250.215.nip.io` | `local-ca-issuer` | 10Gi (`local-path`) |

- **Container Port**: `3080` (HTTP)
- **Cấu hình API Key**: Cấu hình trực tiếp qua giao diện Web Settings sau khi đăng nhập.

---

## 2. Quy trình Build & Deploy với OrbStack (macOS)

### Bước 1: Build & Push Image lên Zot Registry
Từ máy Mac (chạy OrbStack), thực thi script build (tự động biên dịch cross-platform `linux/amd64` cho cụm RKE2):

```bash
./apps/dsh/docker/build.sh
```

### Bước 2: Đồng bộ GitOps
1. Commit và push code lên repository:
   ```bash
   git add .
   git commit -m "feat: add zot platform registry and dsh app"
   git push origin main
   ```
2. ArgoCD ApplicationSet `tenant-applications` sẽ tự động phát hiện thư mục `apps/dsh/overlays/dev` và tạo Application `dsh-dev`.

### Bước 3: Truy cập Web UI
Mở trình duyệt:
- Web UI DeepSeek Harness: `https://dev-dsh.192.168.250.215.nip.io`
- Registry Image Manager: `https://registry.192.168.250.215.nip.io`
