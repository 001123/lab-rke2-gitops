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
  local cmd="kubectl kustomize"
  if command -v kustomize > /dev/null 2>&1; then
    cmd="kustomize build --enable-alpha-plugins --enable-exec"
  fi

  if $cmd "${dir}" > /dev/null 2>&1; then
    echo "✅ HỢP LỆ"
  else
    echo "❌ THẤT BẠI"
    echo "----------------------------------------"
    $cmd "${dir}" || true
    echo "----------------------------------------"
    FAILURES=$((FAILURES + 1))
  fi
}

echo ""
echo "=== 1. Tầng Bootstrap ==="
validate_dir "bootstrap"

echo ""
echo "=== 2. Tầng Platform ==="
validate_dir "platform/local-path-provisioner"
validate_dir "platform/cert-manager"
validate_dir "platform/monitoring"

echo ""
echo "=== 3. Tầng Applications (Dev & Prod) ==="
validate_dir "apps/nginx-demo/base"
validate_dir "apps/nginx-demo/overlays/dev"
validate_dir "apps/nginx-demo/overlays/prod"
validate_dir "apps/anything-llm/base"
validate_dir "apps/anything-llm/overlays/dev"

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo "🎉 TẤT CẢ MANIFEST VÀ OVERLAY ĐỀU HỢP LỆ (100% PASS)!"
  exit 0
else
  echo "🚨 PHÁT HIỆN ${FAILURES} LỖI CÚ PHÁP. VUI LÒNG KIỂM TRA LẠI!"
  exit 1
fi
