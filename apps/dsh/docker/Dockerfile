# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim

# Install system runtime dependencies for coding agent tasks (git, python3, ripgrep, etc.)
RUN apt-get update && apt-get install --yes --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    git \
    jq \
    less \
    procps \
    python3 \
    python3-pip \
    ripgrep \
    tini \
    unzip \
    wget \
    zip \
    && rm -rf /var/lib/apt/lists/*

# Install DeepSeek Harness globally
ARG DSH_VERSION=latest
RUN npm install --global --omit=dev --no-audit --no-fund \
    --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty \
    "@deepseek-ai/dsh@${DSH_VERSION}" \
    && npm cache clean --force

# Create workspace and data directories
WORKDIR /workspace
RUN mkdir -p /root/.dsh /workspace

# Web UI configuration environment variables
ENV HOST=0.0.0.0 \
    PORT=3080 \
    NODE_ENV=production

EXPOSE 3080

ENTRYPOINT ["tini", "--"]
CMD ["dsh", "web", "--host", "0.0.0.0", "--port", "3080", "--no-open"]
