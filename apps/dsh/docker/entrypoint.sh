#!/usr/bin/env bash
set -euo pipefail

# DeepSeek Harness strictly enforces binding to loopback (127.0.0.1) for safety.
# We run a lightweight socat proxy on 0.0.0.0:3080 forwarding to 127.0.0.1:3081.
echo "🔒 Starting port proxy on 0.0.0.0:3080 -> 127.0.0.1:3081..."
socat TCP-LISTEN:3080,fork,reuseaddr TCP:127.0.0.1:3081 &

# DeepSeek Harness validates incoming Host/Origin against trustedHosts for /api/* RPCs.
# Pass --trusted-host so external Ingress domains are accepted instead of returning HTTP 403.
TRUSTED_ARGS=(
  --trusted-host "dev-dsh.192.168.250.215.sslip.io"
  --trusted-host "dev-dsh.192.168.250.215.nip.io"
  --trusted-host "dsh.192.168.250.215.sslip.io"
  --trusted-host "dsh.192.168.250.215.nip.io"
  --trusted-host "192.168.250.215"
)

if [ -n "${TRUSTED_HOSTS:-}" ]; then
  IFS=',' read -ra EXTRA_HOSTS <<< "${TRUSTED_HOSTS}"
  for h in "${EXTRA_HOSTS[@]}"; do
    TRUSTED_ARGS+=(--trusted-host "$h")
  done
fi

echo "🤖 Launching DeepSeek Harness web server on 127.0.0.1:3081 with trusted hosts..."
exec dsh web --port 3081 --no-open "${TRUSTED_ARGS[@]}"
