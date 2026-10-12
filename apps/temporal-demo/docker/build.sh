#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Build & Push Temporal Demo Image to Zot Registry
# ==============================================================================

REGISTRY="${REGISTRY:-registry.192.168.250.215.sslip.io}"
IMAGE_NAME="${IMAGE_NAME:-temporal-demo}"
TAG="${TAG:-latest}"
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${DIR}/.." && pwd)"

echo "========================================================"
echo "📦 Target Image : ${FULL_IMAGE}"
echo "🖥️ Target Arch  : linux/amd64 (RKE2 Cluster)"
echo "========================================================"

cd "${APP_DIR}"

echo "🚀 Building image and pushing to ${FULL_IMAGE}..."
docker buildx build \
  --platform linux/amd64 \
  -f docker/Dockerfile \
  -t "${FULL_IMAGE}" \
  --push \
  .

echo ""
echo "✅ Build & Push thành công!"
