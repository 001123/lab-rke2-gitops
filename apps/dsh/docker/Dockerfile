# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim

# Install system runtime dependencies for coding agent tasks (git, python3, ripgrep, socat, etc.)
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
    socat \
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

# Patch dsh-client-connection to treat ingress / non-loopback hosts as loopback,
# allowing Web UI to load and manage Host settings (Models, Providers, API keys)
RUN node -e '\
const fs = require("fs"); \
const path = require("path"); \
function walk(dir) { \
  let results = []; \
  try { \
    for (const file of fs.readdirSync(dir)) { \
      const full = path.join(dir, file); \
      if (fs.statSync(full).isDirectory()) results = results.concat(walk(full)); \
      else if (file === "client.js" || file === "index.js") results.push(full); \
    } \
  } catch (e) {} \
  return results; \
} \
for (const file of walk("/usr/local/lib/node_modules/@deepseek-ai")) { \
  let content = fs.readFileSync(file, "utf8"); \
  let modified = false; \
  if (content.includes("function isLoopbackHostname(hostname) {")) { \
    content = content.replace("function isLoopbackHostname(hostname) {", "function isLoopbackHostname(hostname) { return true;"); \
    modified = true; \
  } \
  if (content.includes("isLoopback: transport?.ownsHost === true || pageLocation === void 0 || isLoopbackHostname(pageLocation.hostname),")) { \
    content = content.replace("isLoopback: transport?.ownsHost === true || pageLocation === void 0 || isLoopbackHostname(pageLocation.hostname),", "isLoopback: true,"); \
    modified = true; \
  } \
  if (modified) { \
    fs.writeFileSync(file, content); \
    console.log("Patched:", file); \
  } \
}'


# Create workspace and data directories
WORKDIR /workspace
RUN mkdir -p /root/.dsh /workspace

# Copy proxy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3080

ENTRYPOINT ["tini", "--", "/usr/local/bin/entrypoint.sh"]
