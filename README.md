# RKE2 GitOps Infrastructure & Application Repository

Hệ thống quản lý cấu hình và tự động hóa triển khai (**GitOps**) cho cụm **RKE2 (Rancher Kubernetes Engine 2)** chạy trên hệ điều hành **openSUSE Leap Micro 6.2**, tích hợp trực tiếp với máy chủ tự động hóa khởi động [**lab-ipxe-os**](/Users/timi/lab/lab-ipxe-os).

Hệ thống được thiết kế chạy **đồng thời cả 2 môi trường (Dev & Prod) trên cùng một cụm RKE2 duy nhất** (Single-Cluster Multi-Environment) thông qua cơ chế phân tách Namespace và ApplicationSet.

---

## 1. Kiến Trúc Toàn Trình (Architecture Overview)

Kiến trúc kết hợp giữa **App-of-Apps** (khởi động nền tảng hạ tầng) và **ApplicationSet** (tự động quét và phát hiện ứng dụng `dev` và `prod`):

```
                              [ Git Repository ]
                     https://github.com/001123/lab-rke2-gitops
                                      │
                                      ▼
                          [ ArgoCD Root Bootstrap ]
                             (path: "bootstrap")
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼ (Sync Waves 1-3)                        ▼ (Sync Wave 4)
      [ Infrastructure Apps ]                     [ ApplicationSet ]
    (Dùng chung toàn cụm cluster)              (tenant-applications)
                 │                                         │
        ┌────────┴────────┐                       ┌────────┴────────┐
        ▼                 ▼                       ▼                 ▼
 [local-path-storage] [cert-manager]      [nginx-demo-dev]   [nginx-demo-prod]
  /var/local-path     Internal CA          1 replica          2 replicas
  (Btrfs safe)        ClusterIssuer       (dev-demo...nip.io) (demo...nip.io)
```

---

## 2. Cấu Trúc Thư Mục Tối Giản & Chuẩn Hóa

```
lab-rke2-gitops/
├── README.md                           # Tài liệu hướng dẫn kiến trúc và vận hành
├── .gitignore                          # Loại trừ các file tạm và secrets
├── scripts/
│   └── validate.sh                     # Script kiểm tra tính hợp lệ cú pháp Kustomize (100% pass)
├── bootstrap/                          # Điểm neo nạp Root Application của ArgoCD (gitops_path: bootstrap)
│   ├── root-app.yaml                   # Manifest khởi tạo Root Application
│   ├── kustomization.yaml              # Bundle toàn bộ bootstrap
│   ├── infrastructure-apps.yaml        # ArgoCD Apps nạp nền tảng hạ tầng (Waves 1-3)
│   └── applicationset.yaml             # ApplicationSet tự động sinh <app>-dev và <app>-prod (Wave 4)
├── infrastructure/                     # Nền tảng hệ thống cốt lõi (Cluster-scoped, dùng chung)
│   ├── local-path-provisioner/         # Dynamic StorageClass (Rancher Local Path)
│   │   ├── kustomization.yaml
│   │   └── local-path-provisioner.yaml # hostPath: /var/local-path-provisioner (an toàn trên Btrfs)
│   └── cert-manager/                   # Tự động hóa phát hành và gia hạn chứng chỉ SSL/TLS
│       ├── kustomization.yaml
│       ├── namespace.yaml
│       └── cluster-issuers.yaml        # Self-Signed Root CA & Local CA ClusterIssuer
└── apps/                               # Các ứng dụng dịch vụ người dùng (Workloads)
    └── nginx-demo/                     # Ứng dụng mẫu NGINX có Traefik Ingress + TLS tự động
        ├── base/
        │   ├── kustomization.yaml
        │   ├── deployment.yaml
        │   ├── service.yaml
        │   └── ingress.yaml
        └── overlays/
            ├── dev/                    # Môi trường Dev (1 replica, dev-demo.192.168.250.2.nip.io)
            │   ├── kustomization.yaml
            │   └── patch-ingress.yaml
            └── prod/                   # Môi trường Prod (2 replicas, demo.192.168.250.2.nip.io)
                ├── kustomization.yaml
                └── patch-ingress.yaml
```

---

## 3. Điểm Nổi Bật & Tối Ưu Cho openSUSE Leap Micro 6.2

1. **An Toàn Cho Hệ Thống Btrfs Transactional (Read-only Rootfs)**:
   - openSUSE Leap Micro 6.2 bảo vệ hệ thống với rootfs `/` ở chế độ read-only.
   - `local-path-provisioner` được cấu hình ghi dữ liệu Persistent Volumes vào `/var/local-path-provisioner` (phân vùng con của `/var` ghi độc lập), đảm bảo các Pod yêu cầu lưu trữ dữ liệu (PVC) không bao giờ bị lỗi `Read-only file system`.
   - Cung cấp StorageClass `local-path` mặc định toàn cụm (`storageclass.kubernetes.io/is-default-class: "true"`).

2. **Thứ Tự Đồng Bộ (Sync Waves)**:
   - **Wave 1**: `local-path-provisioner` sẵn sàng trước để cụm có Storage.
   - **Wave 2**: `cert-manager` controller và CRD được cài đặt từ Helm Chart Jetstack chính thức (`v1.16.2`).
   - **Wave 3**: Khởi tạo `selfsigned-cluster-issuer` và `local-ca-issuer` ngay sau khi CRD cert-manager đã nạp xong.
   - **Wave 4**: `ApplicationSet` kích hoạt, tự động nạp các ứng dụng nghiệp vụ trong `apps/` cho cả 2 môi trường `dev` và `prod`. Mọi Ingress gắn annotation `cert-manager.io/cluster-issuer: local-ca-issuer` sẽ lập tức được tự động cấp chứng chỉ TLS.

3. **Traefik Ingress Tích Hợp Sẵn**:
   - RKE2 mặc định tích hợp Traefik Ingress Controller. Ingress của ứng dụng sử dụng `ingressClassName: traefik` và phân luồng tên miền wildcard `*.192.168.250.2.nip.io`.

---

## 4. Tích Hợp Vào Máy Chủ Tự Động Hóa `lab-ipxe-os`

Trong file `config/hosts.yaml` của dự án `lab-ipxe-os`, cấu hình node RKE2 trỏ đường dẫn cực kỳ ngắn gọn và sạch sẽ:

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
      # Kích hoạt ArgoCD kết nối trực tiếp vào GitOps repo:
      argocd: true
      argocd_hostname: "argocd.192.168.250.2.nip.io"
      gitops_repo: "https://github.com/001123/lab-rke2-gitops.git"
      gitops_branch: "main"
      gitops_path: "bootstrap"    # <-- Không bị force vào dev, tự nạp cả dev & prod
    network:
      dhcp: false
      ip: "192.168.250.2"
      netmask: "255.255.255.0"
      gateway: "192.168.250.1"
      nameservers: ["192.168.250.1", "1.1.1.1"]
    storage:
      target_disk: "/dev/sda"
```

Khi node cài đặt xong qua iPXE:
- RKE2 tự khởi động và nạp manifest ArgoCD tại `/var/lib/rancher/rke2/server/manifests/argocd.yaml`.
- ArgoCD kéo thư mục `bootstrap` từ repo `https://github.com/001123/lab-rke2-gitops.git`.
- Cụm tự động dựng hạ tầng (`local-path`, `cert-manager`) và tự động deploy song song cả `nginx-demo-dev` và `nginx-demo-prod`!

---

## 5. Danh Mục Địa Chỉ Truy Cập (Domain: 192.168.250.2.nip.io)

| Ứng Dụng | Môi Trường | Replica | Địa Chỉ URL Truy Cập | Namespace |
| :--- | :--- | :--- | :--- | :--- |
| **ArgoCD Dashboard** | System | 1 | `http://argocd.192.168.250.2.nip.io` | `argocd` |
| **Demo NGINX** | **Dev** | 1 | `https://dev-demo.192.168.250.2.nip.io` | `nginx-demo-dev` |
| **Demo NGINX** | **Prod** | 2 | `https://demo.192.168.250.2.nip.io` | `nginx-demo-prod` |

---

## 6. Hướng Dẫn Vận Hành Thường Ngày

### Kiểm Tra Cú Pháp Toàn Bộ Manifest
```bash
./scripts/validate.sh
```

### Thêm Một Ứng Dụng Mới (Ví Dụ: `myapp`)
1. Tạo thư mục: `apps/myapp/base/`, `apps/myapp/overlays/dev/`, `apps/myapp/overlays/prod/`.
2. Định nghĩa manifests K8s và `kustomization.yaml`.
3. Push lên Git:
   ```bash
   git add apps/myapp
   git commit -m "feat: add myapp workload"
   git push origin main
   ```
4. **ApplicationSet** sẽ tự động phát hiện và sinh ngay 2 ứng dụng: `myapp-dev` và `myapp-prod` trên ArgoCD mà bạn không cần cấu hình thêm bất kỳ file nào khác.
