# RKE2 GitOps Infrastructure & Application Repository

Hệ thống quản lý cấu hình và tự động hóa triển khai (**GitOps**) cho cụm **RKE2 (Rancher Kubernetes Engine 2)** chạy trên nền tảng hệ điều hành **openSUSE Leap Micro 6.2**, tích hợp liền mạch với máy chủ khởi động mạng không chạm [**lab-ipxe-os**](/Users/timi/lab/lab-ipxe-os).

---

## 1. Kiến Trúc Toàn Trình (Architecture Overview)

Dự án áp dụng mô hình kết hợp sức mạnh giữa **App-of-Apps** (điều phối nền tảng hạ tầng) và **ApplicationSet** (tự động quét và phát hiện ứng dụng), hỗ trợ đa môi trường (**dev**, **staging**, **prod**) thông qua **Kustomize**:

```
                              [ Git Repository ]
                     https://github.com/001123/lab-rke2-gitops
                                      │
                                      ▼
                      [ ArgoCD Root Application ]
                      (bootstrap/overlays/dev)
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼ (Sync Waves 1-3)                        ▼ (Sync Wave 4)
      [ Infrastructure Apps ]                     [ ApplicationSet ]
   (local-path & cert-manager)                 (tenant-applications)
                 │                                         │
        ┌────────┴────────┐                       ┌────────┴────────┐
        ▼                 ▼                       ▼                 ▼
 [local-path-storage] [cert-manager]      [nginx-demo-dev]   [future-apps...]
  /var/local-path     Internal CA          Traefik Ingress
  (Btrfs safe)        ClusterIssuer        TLS Auto-Issued
```

---

## 2. Cấu Trúc Thư Mục Chuẩn Hóa

```
lab-rke2-gitops/
├── README.md                           # Tài liệu kiến trúc và hướng dẫn vận hành
├── .gitignore                          # Loại trừ các file tạm và secrets
├── scripts/
│   └── validate.sh                     # Script kiểm tra cú pháp Kustomize & manifests (100% pass)
├── bootstrap/                          # Điểm neo nạp Root Application của ArgoCD
│   ├── root-app.yaml                   # Manifest khởi tạo Root Application thủ công (nếu cần)
│   ├── base/
│   │   ├── kustomization.yaml
│   │   ├── infrastructure-apps.yaml    # ArgoCD Apps quản lý cụm Infrastructure (Waves 1-3)
│   │   └── applicationset.yaml         # ApplicationSet tự động phát hiện ứng dụng trong apps/
│   └── overlays/
│       ├── dev/                        # Môi trường Dev (Mặc định cho lab hiện tại)
│       │   └── kustomization.yaml
│       ├── staging/                    # Môi trường Staging
│       │   ├── kustomization.yaml
│       │   ├── patch-infrastructure.yaml
│       │   └── patch-applicationset.yaml
│       └── prod/                       # Môi trường Production
│           ├── kustomization.yaml
│           ├── patch-infrastructure.yaml
│           └── patch-applicationset.yaml
├── infrastructure/                     # Nền tảng hệ thống cốt lõi (Core Platform)
│   ├── local-path-provisioner/         # Dynamic StorageClass (Rancher Local Path)
│   │   ├── base/
│   │   │   ├── kustomization.yaml
│   │   │   └── local-path-provisioner.yaml # Cấu hình hostPath an toàn cho Leap Micro Btrfs
│   │   └── overlays/
│   │       ├── dev/
│   │       ├── staging/
│   │       └── prod/
│   └── cert-manager/                   # Tự động hóa phát hành và gia hạn chứng chỉ TLS
│       ├── base/
│       │   ├── kustomization.yaml
│       │   ├── namespace.yaml
│       │   └── cluster-issuers.yaml    # Self-Signed Root CA & Local CA ClusterIssuer
│       └── overlays/
│           ├── dev/
│           ├── staging/
│           └── prod/
└── apps/                               # Các ứng dụng dịch vụ người dùng (Workloads)
    └── nginx-demo/                     # Ứng dụng mẫu NGINX với Traefik Ingress + TLS
        ├── base/
        │   ├── kustomization.yaml
        │   ├── deployment.yaml
        │   ├── service.yaml
        │   └── ingress.yaml
        └── overlays/
            ├── dev/                    # 1 replica, dev-demo.192.168.250.2.nip.io
            │   ├── kustomization.yaml
            │   └── patch-ingress.yaml
            ├── staging/                # 2 replicas, staging-demo.192.168.250.2.nip.io
            │   ├── kustomization.yaml
            │   └── patch-ingress.yaml
            └── prod/                   # 3 replicas, demo.192.168.250.2.nip.io
                ├── kustomization.yaml
                └── patch-ingress.yaml
```

---

## 3. Điểm Nổi Bật & Tối Ưu Cho openSUSE Leap Micro 6.2

1. **Tương thích với Hệ thống tập tin Btrfs Transactional (Read-only Rootfs)**:
   - openSUSE Leap Micro 6.2 sử dụng cơ chế bảo vệ rootfs bất biến (`/` ở chế độ read-only).
   - Thành phần `local-path-provisioner` được cấu hình ghi dữ liệu Persistent Volumes (PV) vào `/var/local-path-provisioner` (thư mục con của `/var` – phân vùng ghi độc lập trên Btrfs), đảm bảo các Pod yêu cầu lưu trữ dữ liệu (Database, PVC) không bao giờ gặp lỗi `Read-only file system`.
   - StorageClass `local-path` được gán làm **Default StorageClass** (`storageclass.kubernetes.io/is-default-class: "true"`).

2. **Thứ Tự Đồng Bộ (Sync Waves)**:
   - **Wave 1**: `local-path-provisioner` sẵn sàng trước để cụm có Storage.
   - **Wave 2**: `cert-manager` controller và CRD được cài đặt từ Helm Chart chính thức (`v1.16.2`).
   - **Wave 3**: Khởi tạo `selfsigned-cluster-issuer` và `local-ca-issuer` ngay khi CRD của cert-manager đã nạp thành công.
   - **Wave 4**: `ApplicationSet` nạp các ứng dụng nghiệp vụ trong `apps/`. Mọi Ingress gắn annotation `cert-manager.io/cluster-issuer: local-ca-issuer` sẽ lập tức được tự động cấp chứng chỉ TLS.

3. **Traefik Ingress Tích Hợp Sẵn**:
   - RKE2 mặc định tích hợp sẵn Traefik Ingress Controller. Ingress của ứng dụng sử dụng `ingressClassName: traefik` và định tuyến qua domain nội bộ wildcard `*.192.168.250.2.nip.io`.

---

## 4. Tích Hợp Vào Máy Chủ Tự Động Hóa `lab-ipxe-os`

Khi khởi tạo node RKE2 bằng iPXE từ `lab-ipxe-os`, cấu hình node trong file `config/hosts.yaml` của `lab-ipxe-os`:

```yaml
hosts:
  "bc:24:11:00:24:35":
    hostname: "rke2-micro-node"
    os: suse-micro
    version: "6.2"
    profile: rke2-single-node
    custom:
      rke2_ingress: "traefik"
      rke2_cni: "canal"
      # Kích hoạt ArgoCD và kết nối trực tiếp vào GitOps repo này:
      argocd: true
      argocd_hostname: "argocd.192.168.250.2.nip.io"
      gitops_repo: "https://github.com/001123/lab-rke2-gitops.git"
      gitops_branch: "main"
      gitops_path: "bootstrap/overlays/dev"
    network:
      dhcp: false
      ip: "192.168.250.2"
      netmask: "255.255.255.0"
      gateway: "192.168.250.1"
      nameservers: ["192.168.250.1", "1.1.1.1"]
    storage:
      target_disk: "/dev/sda"
```

Khi node cài xong:
- RKE2 tự khởi động và nạp manifest ArgoCD tại `/var/lib/rancher/rke2/server/manifests/argocd.yaml`.
- ArgoCD tự động pull `bootstrap/overlays/dev` từ repo `https://github.com/001123/lab-rke2-gitops.git`.
- Cụm tự động cài đặt `local-path`, `cert-manager`, và ứng dụng `nginx-demo` mà không cần bất kỳ thao tác thủ công nào!

---

## 5. Hướng Dẫn Vận Hành & Sử Dụng

### 5.1. Kiểm Tra Cú Pháp Toàn Bộ Repo
Trước khi commit hoặc push code lên Git, luôn chạy script xác minh:
```bash
./scripts/validate.sh
```

### 5.2. Đẩy Code Lên Remote Repository
```bash
git init
git add .
git commit -m "feat: initial rke2 gitops structure with local-path, cert-manager and nginx demo"
git branch -M main
git remote add origin https://github.com/001123/lab-rke2-gitops.git
git push -u origin main
```

### 5.3. Thêm Một Ứng Dụng Mới Vào Cụm
Nhờ có **ApplicationSet**, bạn không cần phải tạo file Application thủ công cho ArgoCD:
1. Tạo thư mục mới: `apps/<my-app>/base/` và `apps/<my-app>/overlays/dev/`.
2. Định nghĩa manifests K8s và `kustomization.yaml` bên trong.
3. Commit và push lên nhánh `main`.
4. ArgoCD sẽ lập tức phát hiện thư mục mới và tự động tạo Application `<my-app>-dev` tương ứng!

### 5.4. Quảng Bá Ứng Dụng Sang Staging / Production
Khi chuyển từ `dev` sang `staging` hoặc `prod`:
- Kiểm tra bản dựng: `kubectl kustomize apps/<my-app>/overlays/staging`
- Thư mục overlay staging/prod có thể tùy biến số lượng replica, tài nguyên CPU/RAM, và domain Ingress riêng biệt.

---

## 6. Danh Mục Địa Chỉ Truy Cập Lab (Domain: 192.168.250.2.nip.io)

| Dịch Vụ | Địa Chỉ Truy Cập URL | Mô Tả |
| :--- | :--- | :--- |
| **ArgoCD Dashboard** | `http://argocd.192.168.250.2.nip.io` | Quản trị giao diện GitOps (user: `admin`, pass: xem script `get-argocd-password`) |
| **Demo NGINX (Dev)** | `https://dev-demo.192.168.250.2.nip.io` | Môi trường phát triển (1 replica, SSL tự cấp) |
| **Demo NGINX (Staging)** | `https://staging-demo.192.168.250.2.nip.io` | Môi trường kiểm thử (2 replicas, SSL tự cấp) |
| **Demo NGINX (Prod)** | `https://demo.192.168.250.2.nip.io` | Môi trường thực tế (3 replicas, SSL tự cấp) |
