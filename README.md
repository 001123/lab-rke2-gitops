# RKE2 GitOps Platform & Application Repository

Configuration management and automated deployment (**GitOps**) repository for **RKE2 (Rancher Kubernetes Engine 2)** clusters running on **openSUSE Leap Micro 6.2**, integrated directly with the [**lab-ipxe-os**](/Users/timi/lab/lab-ipxe-os) automated provisioning server.

The system is designed to run **both environments (Dev & Prod) concurrently on a single RKE2 cluster** (Single-Cluster Multi-Environment) via Namespace isolation and ArgoCD ApplicationSets.

---

## 1. Architecture Overview

A hybrid architecture combining **App-of-Apps** (bootstrapping core platform services) and **ApplicationSet** (automated discovery and deployment of `dev` and `prod` applications):

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
           [ Platform Apps ]                        [ ApplicationSet ]
   (Cluster-wide shared platform)              (tenant-applications)
                 │                                         │
        ┌────────┴────────┐                       ┌────────┴────────┐
        ▼                 ▼                       ▼                 ▼
 [local-path-storage] [cert-manager]      [nginx-demo-dev]   [nginx-demo-prod]
  /var/local-path     Internal CA          1 replica          2 replicas
  (Btrfs safe)        ClusterIssuer       (dev-demo...nip.io) (demo...nip.io)
```

---

## 2. Standardized & Streamlined Directory Structure

```
lab-rke2-gitops/
├── README.md                           # Architecture and operations documentation
├── .gitignore                          # Ignores temporary files and secrets
├── scripts/
│   └── validate.sh                     # Kustomize syntax validation script (100% pass)
├── bootstrap/                          # ArgoCD Root Application entrypoint (gitops_path: bootstrap)
│   ├── root-app.yaml                   # Root Application bootstrap manifest
│   ├── kustomization.yaml              # Root bootstrap bundle
│   ├── platform-apps.yaml              # ArgoCD Apps for core platform services (Waves 1-3)
│   └── applicationset.yaml             # ApplicationSet generating <app>-dev and <app>-prod (Wave 4)
├── platform/                           # Core system platform (Cluster-scoped, shared)
│   ├── local-path-provisioner/         # Dynamic StorageClass (Rancher Local Path)
│   │   ├── kustomization.yaml
│   │   └── local-path-provisioner.yaml # hostPath: /var/local-path-provisioner (Btrfs safe)
│   └── cert-manager/                   # Automated SSL/TLS certificate issuance and renewal
│       ├── kustomization.yaml
│       ├── namespace.yaml
│       └── cluster-issuers.yaml        # Self-Signed Root CA & Local CA ClusterIssuer
└── apps/                               # Workloads & user-facing services
    └── nginx-demo/                     # Sample NGINX app with Traefik Ingress + automated TLS
        ├── base/
        │   ├── kustomization.yaml
        │   ├── deployment.yaml
        │   ├── service.yaml
        │   └── ingress.yaml
        └── overlays/
            ├── dev/                    # Dev environment (1 replica, dev-demo.192.168.250.2.nip.io)
            │   ├── kustomization.yaml
            │   └── patch-ingress.yaml
            └── prod/                   # Prod environment (2 replicas, demo.192.168.250.2.nip.io)
                ├── kustomization.yaml
                └── patch-ingress.yaml
```

---

## 3. Key Highlights & openSUSE Leap Micro 6.2 Optimizations

1. **Btrfs Transactional (Read-only Rootfs) Safety**:
   - openSUSE Leap Micro 6.2 protects the operating system with a read-only rootfs (`/`).
   - `local-path-provisioner` is configured to persist volumes under `/var/local-path-provisioner` (a writable Btrfs subvolume under `/var`), ensuring Pod Persistent Volume Claims (PVC) never encounter `Read-only file system` errors.
   - Provides a cluster-wide default StorageClass `local-path` (`storageclass.kubernetes.io/is-default-class: "true"`).

2. **Deterministic Sync Order (Sync Waves)**:
   - **Wave 1**: `local-path-provisioner` deploys first to make dynamic storage available.
   - **Wave 2**: `cert-manager` controller and CRDs install from the official Jetstack Helm chart (`v1.16.2`).
   - **Wave 3**: Creates `selfsigned-cluster-issuer` and `local-ca-issuer` once the cert-manager CRDs are fully loaded and operational.
   - **Wave 4**: `ApplicationSet` activates, automatically discovering and deploying workloads under `apps/` across both `dev` and `prod` environments. Any Ingress annotated with `cert-manager.io/cluster-issuer: local-ca-issuer` is immediately issued a valid TLS certificate.

3. **Built-in Traefik Ingress**:
   - RKE2 bundles the Traefik Ingress Controller by default. Ingress resources use `ingressClassName: traefik` and route using wildcard domain naming: `*.192.168.250.2.nip.io`.

---

## 4. Integration with `lab-ipxe-os` Provisioner

In `config/hosts.yaml` of the `lab-ipxe-os` project, configure the RKE2 node with clean, concise GitOps settings:

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
      # Enable ArgoCD and connect directly to the GitOps repo:
      argocd: true
      argocd_hostname: "argocd.192.168.250.2.nip.io"
      gitops_repo: "https://github.com/001123/lab-rke2-gitops.git"
      gitops_branch: "main"
      gitops_path: "bootstrap"    # <-- Pointing to bootstrap loads both dev & prod
    network:
      dhcp: false
      ip: "192.168.250.2"
      netmask: "255.255.255.0"
      gateway: "192.168.250.1"
      nameservers: ["192.168.250.1", "1.1.1.1"]
    storage:
      target_disk: "/dev/sda"
```

Once the node completes its iPXE unattended installation:
- RKE2 starts up and automatically loads the ArgoCD manifest at `/var/lib/rancher/rke2/server/manifests/argocd.yaml`.
- ArgoCD clones the `bootstrap` path from `https://github.com/001123/lab-rke2-gitops.git`.
- The cluster bootstraps core platform services (`local-path`, `cert-manager`) and concurrently deploys both `nginx-demo-dev` and `nginx-demo-prod`!

---

## 5. Service Directory & Ingress URLs (Domain: 192.168.250.2.nip.io)

| Application | Environment | Replicas | Access URL | Namespace |
| :--- | :--- | :--- | :--- | :--- |
| **ArgoCD Dashboard** | System | 1 | `http://argocd.192.168.250.2.nip.io` | `argocd` |
| **Demo NGINX** | **Dev** | 1 | `https://dev-demo.192.168.250.2.nip.io` | `nginx-demo-dev` |
| **Demo NGINX** | **Prod** | 2 | `https://demo.192.168.250.2.nip.io` | `nginx-demo-prod` |

---

## 6. Cluster Access & Kubectl Setup

> [!NOTE]
> The `kubeconfig` file contains sensitive cluster credentials and is excluded from Git tracking via `.gitignore`. You must provide this file locally to interact with the cluster using `kubectl`.

### Quick Setup (One-Liner via SSH)

Fetch the kubeconfig directly from the RKE2 node, replace the localhost loopback address (`127.0.0.1`) with the node's LAN IP (`192.168.250.2`), and secure file permissions:

```bash
# Fetch and patch kubeconfig into repository root
ssh root@192.168.250.2 "cat /etc/rancher/rke2/rke2.yaml" | sed 's/127.0.0.1/192.168.250.2/g' > ./kubeconfig
chmod 600 ./kubeconfig

# Export KUBECONFIG for your current terminal session
export KUBECONFIG=$(pwd)/kubeconfig
```

### Manual Setup Steps

If configuring manually or copying via SCP:
1. Copy `/etc/rancher/rke2/rke2.yaml` from the node (`192.168.250.2`).
2. Edit the cluster server address:
   ```yaml
   # Change:
   server: https://127.0.0.1:6443
   # To:
   server: https://192.168.250.2:6443
   ```
3. Save the file as `./kubeconfig` in the root of this repository.
4. Set permissions and export the environment variable:
   ```bash
   chmod 600 ./kubeconfig
   export KUBECONFIG=$(pwd)/kubeconfig
   ```

### Verify Cluster Connectivity

```bash
# Check cluster node status
kubectl get nodes -o wide

# Check all running workloads across dev, prod, and system namespaces
kubectl get pods -A
```

---

## 7. Daily Operations Guide

### Validate All Manifests
```bash
./scripts/validate.sh
```

### Adding a New Application (e.g., `myapp`)
1. Create directories: `apps/myapp/base/`, `apps/myapp/overlays/dev/`, `apps/myapp/overlays/prod/`.
2. Define the Kubernetes manifests and `kustomization.yaml` files.
3. Commit and push to Git:
   ```bash
   git add apps/myapp
   git commit -m "feat: add myapp workload"
   git push origin main
   ```
4. **ApplicationSet** will automatically detect the new application and deploy both `myapp-dev` and `myapp-prod` to ArgoCD without any manual configuration changes.

