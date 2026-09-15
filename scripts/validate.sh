#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# GitOps Manifest Validation Script
# ==============================================================================
# Kiểm tra tính toàn vẹn cú pháp của tất cả các Kustomize overlay và manifests
# ==============================================================================

echo "🔍 Bắt đầu kiểm tra cú pháp Kustomize cho các tầng..."

FAILURES=0

validate_dir() {
  local dir="$1"
  echo -n "  ▶ Đang kiểm tra: ${dir} ... "
  if kubectl kustomize "${dir}" > /dev/null 2>&1; then
    echo "✅ HỢP LỆ"
  else
    echo "❌ THẤT BẠI"
    echo "----------------------------------------"
    kubectl kustomize "${dir}" || true
    echo "----------------------------------------"
    FAILURES=$((FAILURES + 1))
  fi
}

echo ""
echo "=== 1. Tầng Bootstrap ==="
validate_dir "bootstrap/base"
validate_dir "bootstrap/overlays/dev"
validate_dir "bootstrap/overlays/staging"
validate_dir "bootstrap/overlays/prod"

echo ""
echo "=== 2. Tầng Infrastructure - Local Path Provisioner ==="
validate_dir "infrastructure/local-path-provisioner/base"
validate_dir "infrastructure/local-path-provisioner/overlays/dev"
validate_dir "infrastructure/local-path-provisioner/overlays/staging"
validate_dir "infrastructure/local-path-provisioner/overlays/prod"

echo ""
echo "=== 3. Tầng Infrastructure - Cert-Manager ==="
validate_dir "infrastructure/cert-manager/base"
validate_dir "infrastructure/cert-manager/overlays/dev"
validate_dir "infrastructure/cert-manager/overlays/staging"
validate_dir "infrastructure/cert-manager/overlays/prod"

echo ""
echo "=== 4. Tầng Applications - Nginx Demo ==="
validate_dir "apps/nginx-demo/base"
validate_dir "apps/nginx-demo/overlays/dev"
validate_dir "apps/nginx-demo/overlays/staging"
validate_dir "apps/nginx-demo/overlays/prod"

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo "🎉 TẤT CẢ MANIFEST VÀ OVERLAY ĐỀU HỢP LỆ (100% PASS)!"
  exit 0
else
  echo "🚨 PHÁT HIỆN ${FAILURES} LỖI CÚ PHÁP. VUI LÒNG KIỂM TRA LẠI!"
  exit 1
fi
