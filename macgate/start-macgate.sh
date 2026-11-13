#!/bin/bash
# MacGate — start the agent + Cloudflare Tunnel on macOS.
# Usage:
#   ./start-macgate.sh /path/to/project
# Example:
#   ./start-macgate.sh /Users/admin/Documents/GitHub/mobi-army3-web
set -u
cd "$(dirname "$0")"

PROJECT="${1:-$PWD}"
PORT=46148

command -v node >/dev/null 2>&1 || { echo "❌ Chưa có Node.js. Cài tại https://nodejs.org (bản LTS) rồi chạy lại."; exit 1; }

# --- cloudflared (download once, official Cloudflare binary) ---
if ! command -v cloudflared >/dev/null 2>&1 && [ ! -x ./cloudflared ]; then
  ARCH="$(uname -m)"
  if [ "$ARCH" = "arm64" ]; then CF_ARCH="arm64"; else CF_ARCH="amd64"; fi
  echo "⬇️  Tải cloudflared ($CF_ARCH) từ GitHub của Cloudflare..."
  curl -L -o cloudflared.tgz "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${CF_ARCH}.tgz" || { echo "❌ Tải cloudflared thất bại, kiểm tra mạng."; exit 1; }
  tar -xzf cloudflared.tgz cloudflared && rm -f cloudflared.tgz
  chmod +x ./cloudflared
fi
CF="$(command -v cloudflared || echo ./cloudflared)"

echo "🚀 Khởi động MacGate agent cho project: $PROJECT"
node macgate.mjs --root "$PROJECT" --port "$PORT" > macgate.log 2>&1 &
AGENT_PID=$!
trap 'kill $AGENT_PID 2>/dev/null' EXIT
sleep 1

echo ""
echo "================ HƯỚNG DẪN GHÉP NỐI ================"
grep -A2 "PAIR CODE" macgate.log || echo "(Đã pair từ trước — xem macgate.log nếu cần)"
echo "1) Copy PAIR CODE ở trên."
echo "2) Đợi link https://*.trycloudflare.com hiện ra bên dưới."
echo "3) Gửi cho Muse CẢ link lẫn PAIR CODE trong chat."
echo "Giữ nguyên cửa sổ Terminal này khi đang làm việc. Ctrl+C để dừng tất cả."
echo "===================================================="
echo ""

"$CF" tunnel --url "http://127.0.0.1:${PORT}"
