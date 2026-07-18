#!/usr/bin/env bash
# stop.sh - terminate the dev server launched by start.sh
# Frees the port. Safe to run even if no server is up.

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3100}"

echo "Looking for dev server on port $PORT..."

# Strategy 1: PID file
if [ -f dev.pid ]; then
  PID_FROM_FILE=$(cat dev.pid 2>/dev/null || true)
  if [ -n "${PID_FROM_FILE:-}" ]; then
    if kill -0 "$PID_FROM_FILE" 2>/dev/null; then
      kill -TERM "$PID_FROM_FILE" 2>/dev/null || true
      sleep 1
      if kill -0 "$PID_FROM_FILE" 2>/dev/null; then
        kill -KILL "$PID_FROM_FILE" 2>/dev/null || true
      fi
      echo "Stopped PID $PID_FROM_FILE from dev.pid"
    else
      echo "No live process for PID $PID_FROM_FILE from dev.pid"
    fi
  else
    echo "dev.pid was empty, ignoring"
  fi
  rm -f dev.pid
fi

# Strategy 2: anything listening on the port (skip cloudflared tunnel)
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti tcp:$PORT 2>/dev/null || true)
  if [ -n "${PIDS:-}" ]; then
    for p in $PIDS; do
      # Don't kill the Cloudflare tunnel — it's a separate service
      if [ -f "/proc/$p/comm" ] && [ "$(cat "/proc/$p/comm" 2>/dev/null)" = "cloudflared" ]; then
        echo "Skipped cloudflared PID $p"
        continue
      fi
      kill -TERM "$p" 2>/dev/null || true
      echo "Stopped listener PID $p"
    done
    sleep 1
    PIDS=$(lsof -ti tcp:$PORT 2>/dev/null || true)
    if [ -n "${PIDS:-}" ]; then
      for p in $PIDS; do
        kill -KILL "$p" 2>/dev/null || true
      done
    fi
  fi
elif command -v fuser >/dev/null 2>&1; then
  fuser -k -TERM "$PORT/tcp" 2>/dev/null || true
else
  echo "No lsof/fuser available; cannot check port listener. Skipped."
fi

# Strategy 3: orphan next-dev node processes (best-effort)
if command -v pgrep >/dev/null 2>&1; then
  for p in $(pgrep -f "next.*dev.*-p.*$PORT" 2>/dev/null || true); do
    kill -TERM "$p" 2>/dev/null || true
    echo "Stopped node PID $p"
  done
fi

echo "Done. Port $PORT should be free."
