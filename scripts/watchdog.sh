#!/bin/bash
# Watchdog: keeps all Globo services alive
# Usage: nohup bash scripts/watchdog.sh &

PROJECT_DIR="/Users/marcelinofranciscomartinez/Documents/Desarrollo/globo"
LOG="/tmp/globo-watchdog.log"

echo "[$(date)] Watchdog started" >> "$LOG"

while true; do
  # 1. Docker containers (auto-restart via docker-compose)
  if ! docker ps --format "{{.Names}}" | grep -q "globo-traccar-1"; then
    echo "[$(date)] Traccar down — restarting" >> "$LOG"
    cd "$PROJECT_DIR" && docker compose up -d traccar >> "$LOG" 2>&1
  fi

  # 2. Bore tunnel
  if ! pgrep -f "bore local 5023" > /dev/null; then
    echo "[$(date)] Bore down — restarting" >> "$LOG"
    nohup bore local 5023 --to bore.pub --port 16772 >> /tmp/bore-tunnel.log 2>&1 &
    sleep 2
  fi

  # 3. WebSocket bridge (Traccar → Redis)
  if ! pgrep -f "websocket" > /dev/null; then
    echo "[$(date)] WS Bridge down — restarting" >> "$LOG"
    cd "$PROJECT_DIR" && nohup npx tsx -e "
require('dotenv').config();
const { startTraccarBridge } = require('./src/lib/websocket');
startTraccarBridge();
setInterval(() => {}, 60000);
" >> /tmp/ws-bridge.log 2>&1 &
    sleep 3
  fi

  # 4. Next.js dev server
  if ! lsof -i :3002 2>/dev/null | grep -q LISTEN; then
    echo "[$(date)] Next.js down — restarting" >> "$LOG"
    cd "$PROJECT_DIR" && nohup npx next dev -p 3002 >> /tmp/nextjs-dev.log 2>&1 &
    sleep 5
  fi

  sleep 30
done
