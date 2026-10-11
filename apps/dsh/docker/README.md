# DeepSeek Harness Docker Image Builder

Thư mục này chứa Dockerfile và script để build container image cho **DeepSeek Harness (`dsh`)** từ máy Mac (OrbStack) và push lên **Zot Registry** nội bộ của cụm RKE2.

## Yêu cầu
1. Đã bật OrbStack trên macOS.
2. Đã thêm `registry.192.168.250.215.nip.io` vào mục Insecure Registries của OrbStack (Settings -> Docker).

## Hướng dẫn Build & Push

Chạy trực tiếp script:
```bash
./apps/dsh/docker/build.sh
```

Hoặc chạy lệnh buildx thủ công:
```bash
docker buildx build \
  --platform linux/amd64 \
  -t registry.192.168.250.215.nip.io/dsh:latest \
  --push \
  apps/dsh/docker/
```
