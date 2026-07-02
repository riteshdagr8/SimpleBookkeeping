#!/usr/bin/env bash
# start.sh - launch the dev server detached, on port 3100.
# Logs to dev.out.log and dev.err.log in this folder.
# Survives closing this terminal.
# Stop with stop.sh

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3100}"

# Refuse to start if the port already has a listener.
if (echo > /dev/tcp/127.0.0.1/$PORT) 2>/dev/null; then
  PIDS=$(lsof -ti tcp:$PORT 2>/dev/null || true)
  echo "Port $PORT is already in use (PID ${PIDS:-?}). Run stop.sh first."
  exit 1
fi

# Rotate logs.
if [ -f dev.out.log ]; then
  [ -f dev.prev.out.log ] && rm -f dev.prev.out.log
  mv dev.out.log dev.prev.out.log
fi
[ -f dev.err.log ] && rm -f dev.err.log

echo "Starting dev server on port $PORT... logs: dev.out.log, dev.err.log"

# Launch npx in a fully detached subshell. $! is the PID of the new
# npx process, which we save to dev.pid for stop.sh.
nohup bash -c "exec npx next dev -H 0.0.0.0 -p $PORT" \
  > dev.out.log 2> dev.err.log &
echo $! > dev.pid
PID=$(cat dev.pid)
echo "Launched PID $PID"

echo "Waiting up to 30s for it to come up..."
ATTEMPTS=0
while [ $ATTEMPTS -lt 30 ]; do
  if curl -fsS -o /dev/null -m 3 "http://localhost:$PORT/login" 2>/dev/null; then
    echo
    echo "Dev server is up. Open http://localhost:$PORT"
    echo "Logs: $(pwd)/dev.out.log, dev.err.log"
    echo "To stop: stop.sh"
    exit 0
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep 1
done

echo
echo "WARNING: server started (PID $PID) but did not respond to HTTP within 30s."
echo "It may still be compiling. Check the log:"
echo "  $(pwd)/dev.out.log"
echo "  $(pwd)/dev.err.log"
exit 0
