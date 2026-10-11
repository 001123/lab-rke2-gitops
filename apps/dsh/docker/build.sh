#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Build & Push DeepSeek Harness (DSH) Image to Zot Registry
# ==============================================================================

REGISTRY="${REGISTRY:-registry.192.168.250.215.sslip.io}"
IMAGE_NAME="${IMAGE_NAME:-dsh}"
TAG="${TAG:-latest}"
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"

echo "========================================================"
echo "📦 Target Image : ${FULL_IMAGE}"
echo "🖥️ Target Arch  : linux/amd64 (RKE2 Cluster)"
echo "========================================================"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${DIR}"

# Buildx cross-compiles to linux/amd64 and pushes directly to Zot OCI Registry
echo "🚀 Building image and pushing to ${FULL_IMAGE}..."
docker buildx build \
  --platform linux/amd64 \
  -t "${FULL_IMAGE}" \
  --push \
  .

echo ""
echo "✅ Build & Push thành công!"
echo "👉 Bạn có thể xem image trên Web UI: https://${REGISTRY}"
