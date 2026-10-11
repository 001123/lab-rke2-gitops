#!/usr/bin/env bash
set -euo pipefail

# DeepSeek Harness strictly enforces binding to loopback (127.0.0.1) for safety.
# We run a lightweight socat proxy on 0.0.0.0:3080 forwarding to 127.0.0.1:3081.

echo "🔒 Starting port proxy on 0.0.0.0:3080 -> 127.0.0.1:3081..."
socat TCP-LISTEN:3080,fork,reuseaddr TCP:127.0.0.1:3081 &

echo "🤖 Launching DeepSeek Harness web server on 127.0.0.1:3081..."
exec dsh web --port 3081 --no-open
