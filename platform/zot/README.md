# Zot OCI Registry (Platform Component)

Zot là OCI Native Container Registry chuẩn CNCF, siêu nhẹ, tích hợp sẵn Web UI quản trị image, layers và quét bảo mật.

- **URL Web UI & Registry API**: `https://registry.192.168.250.215.nip.io`
- **Namespace**: `zot`
- **Storage**: `30Gi` Persistent Volume (`storageClassName: local-path`)
- **Xác thực**: Anonymous pull/push trong mạng LAN.

---

## 1. Cấu hình trên macOS (OrbStack / Docker CLI)

Vì Registry sử dụng chứng chỉ nội bộ được cấp bởi `local-ca-issuer` trong cụm RKE2:

### Cách 1: Thêm Insecure Registry trong OrbStack (Nhanh nhất)
1. Mở ứng dụng **OrbStack** trên Mac.
2. Vào **Settings** -> mục **Docker**.
3. Thêm `registry.192.168.250.215.nip.io` vào danh sách **Insecure Registries**.
4. Bấm Apply / Restart Docker engine.

### Cách 2: Tin cậy Root CA trên Docker client
Copy chứng chỉ CA nội bộ vào thư mục certs của Docker trên Mac:
```bash
sudo mkdir -p /etc/docker/certs.d/registry.192.168.250.215.nip.io
sudo cp certs/lab-root-ca.crt /etc/docker/certs.d/registry.192.168.250.215.nip.io/ca.crt
```

---

## 2. Cách Build và Push Image từ Mac (OrbStack)

Vì node RKE2 chạy chip `amd64`, bạn luôn chỉ định `--platform linux/amd64`:

```bash
# Build và push thẳng lên Zot Registry
docker buildx build --platform linux/amd64 \
  -t registry.192.168.250.215.nip.io/<app-name>:<tag> \
  --push .
```

---

## 3. Cấu hình trên cụm RKE2 (Tùy chọn)

Nếu node RKE2 cần bỏ qua kiểm tra SSL của local CA khi pull image, file cấu hình `/etc/rancher/rke2/registries.yaml` trên node server:

```yaml
mirrors:
  "registry.192.168.250.215.nip.io":
    endpoint:
      - "https://registry.192.168.250.215.nip.io"
configs:
  "registry.192.168.250.215.nip.io":
    tls:
      insecure_skip_verify: true
```
