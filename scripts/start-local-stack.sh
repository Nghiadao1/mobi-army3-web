#!/bin/bash
# start-local-stack.sh — one-command starter for the mobi-army3-web local backend.
# Draft prepared 2026-11-14 from ~/workspace/macgate/LOCAL_STACK.md (set up 2026-11-13).
# Install location (proposed): scripts/start-local-stack.sh in the repo, chmod +x.
# Usage:
#   ./scripts/start-local-stack.sh          # start anything that isn't running
#   ./scripts/start-local-stack.sh status   # just report what's up / down
# The DB password is NEVER stored in this script or the repo. Provide it via
#   ARMY2_DB_PASSWORD env var, or run interactively and type it when prompted.
#   (Muse keeps the password only in ~/workspace/.sheepgate/army2-db.pass, 0600.)
set -u
cd "$(dirname "$0")/.." || exit 1
PROJECT_ROOT="$(pwd)"

MYSQL_BASE="${MYSQL_BASE:-/Users/admin/mysql/mysql-8.4.13-macos15-arm64}"
MYSQL_DATA="${MYSQL_DATA:-/Users/admin/mysql/data}"
JAVA_HOME="${JAVA_HOME:-/Users/admin/jdks/jdk-21.0.13+9/Contents/Home}"
export JAVA_HOME
SERVER_BIN="$PROJECT_ROOT/server/build/install/army2-original-server/bin/army2-original-server"
SERVER_CWD="$PROJECT_ROOT/upstream/MobiArmy2-Server"

is_up() { nc -z 127.0.0.1 "$1" 2>/dev/null; }

status() {
  echo "== mobi-army3-web local stack ($PROJECT_ROOT) =="
  for spec in "3306:MySQL" "8122:game server" "8081:relay" "5180:client (dev server)"; do
    port="${spec%%:*}"; name="${spec#*:}"
    if is_up "$port"; then echo "  [UP]   $name (127.0.0.1:$port)"; else echo "  [DOWN] $name (127.0.0.1:$port)"; fi
  done
  if command -v tailscale >/dev/null 2>&1; then
    echo "-- tailscale funnel --"
    tailscale funnel status 2>&1 | head -n 5
  fi
  echo "Share link (needs relay UP + funnel ON + Mac awake):"
  echo "  https://nghiadao1.github.io/mobi-army3-web/?relay=wss://nghia.tail41b37a.ts.net"
}

if [ "${1:-}" = "status" ]; then status; exit 0; fi

# --- MySQL ---
if ! is_up 3306; then
  echo "Starting MySQL..."
  "$MYSQL_BASE/bin/mysqld" --basedir="$MYSQL_BASE" --datadir="$MYSQL_DATA" --user=admin \
    --port=3306 --bind-address=127.0.0.1 --socket=/tmp/mysql.sock --daemonize
  for _ in $(seq 1 30); do is_up 3306 && break; sleep 1; done
  is_up 3306 && echo "  MySQL up." || { echo "  MySQL FAILED to start — see MySQL error log."; exit 1; }
else echo "MySQL already up."; fi

# --- Game server ---
if ! is_up 8122; then
  [ -x "$SERVER_BIN" ] || { echo "Server binary missing — build first: (cd web-client && JAVA_HOME=$JAVA_HOME ./gradlew -p server --no-daemon installDist)"; exit 1; }
  if [ -z "${ARMY2_DB_PASSWORD:-}" ]; then
    if [ -t 0 ]; then printf "MySQL password for user army2: "; stty -echo; read -r ARMY2_DB_PASSWORD; stty echo; echo; else
      echo "Set ARMY2_DB_PASSWORD env var (password is not stored in this script)."; exit 1; fi
  fi
  echo "Starting game server (port 8122, log /tmp/army2-server.log)..."
  ( cd "$SERVER_CWD" && ARMY2_JDBC_URL='jdbc:mysql://127.0.0.1:3306/army?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC' \
    ARMY2_DB_USER=army2 ARMY2_DB_PASSWORD="$ARMY2_DB_PASSWORD" ARMY2_TCP_PORT=8122 \
    nohup "$SERVER_BIN" >> /tmp/army2-server.log 2>&1 & )
  for _ in $(seq 1 30); do is_up 8122 && break; sleep 1; done
  is_up 8122 && echo "  Game server up." || { echo "  Game server FAILED — tail /tmp/army2-server.log"; exit 1; }
else echo "Game server already up."; fi

# --- Relay ---
if ! is_up 8081; then
  echo "Starting relay (port 8081, log /tmp/army2-relay.log)..."
  nohup node server/relay.mjs >> /tmp/army2-relay.log 2>&1 &
  for _ in $(seq 1 15); do is_up 8081 && break; sleep 1; done
  is_up 8081 && echo "  Relay up." || { echo "  Relay FAILED — tail /tmp/army2-relay.log"; exit 1; }
else echo "Relay already up."; fi

# --- Client dev server ---
if ! is_up 5180; then
  echo "Starting client dev server (port 5180, log /tmp/army2-dev.log)..."
  nohup node scripts/dev-original.mjs >> /tmp/army2-dev.log 2>&1 &
  for _ in $(seq 1 15); do is_up 5180 && break; sleep 1; done
  is_up 5180 && echo "  Client up: http://127.0.0.1:5180" || { echo "  Client FAILED — tail /tmp/army2-dev.log"; exit 1; }
else echo "Client already up."; fi

echo; status
