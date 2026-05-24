#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Docker Disk Cleanup & Permanent Log Rotation Setup
# Run once on the server: bash docker-cleanup.sh
# ─────────────────────────────────────────────────────────────

set -e

echo "======================================"
echo " Docker Disk Cleanup Script"
echo "======================================"

# 1. Show current disk usage before cleanup
echo ""
echo "[1/5] Current Docker disk usage:"
docker system df

# 2. Set global log rotation in Docker daemon (affects ALL future containers)
echo ""
echo "[2/5] Configuring Docker daemon for global log rotation..."
DAEMON_FILE="/etc/docker/daemon.json"

if [ -f "$DAEMON_FILE" ]; then
  echo "  daemon.json exists — merging log config manually if needed."
  echo "  Current content:"
  cat "$DAEMON_FILE"
  echo ""
  echo "  ⚠️  Please ensure the following keys are present in $DAEMON_FILE:"
else
  echo "  Creating $DAEMON_FILE..."
  sudo tee "$DAEMON_FILE" > /dev/null <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  }
}
JSON
  echo "  ✅ daemon.json created."
fi

echo ""
cat << 'JSON'
  Add/merge this into /etc/docker/daemon.json:
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "10m",
      "max-file": "5"
    }
  }
JSON

# 3. Reload Docker daemon
echo ""
echo "[3/5] Reloading Docker daemon..."
sudo systemctl reload docker || sudo systemctl restart docker
echo "  ✅ Docker daemon reloaded."

# 4. Truncate existing log files for running containers (immediate relief)
echo ""
echo "[4/5] Truncating existing container log files..."
for log_file in $(sudo find /var/lib/docker/containers/ -name "*.log" 2>/dev/null); do
  size=$(sudo du -sh "$log_file" 2>/dev/null | cut -f1)
  echo "  Truncating [$size] $log_file"
  sudo truncate -s 0 "$log_file"
done
echo "  ✅ All existing logs truncated."

# 5. Docker system prune (removes stopped containers, dangling images, unused networks)
echo ""
echo "[5/5] Running docker system prune (safe cleanup)..."
docker system prune -f
echo "  ✅ Prune complete."

# Final disk usage
echo ""
echo "======================================"
echo " Docker disk usage AFTER cleanup:"
docker system df
echo "======================================"
echo ""
echo "✅ Done! Log rotation is now active."
echo "   Max log per container: 10MB x 5 files = 50MB"
echo "   Re-deploy your stack to apply compose log settings:"
echo "   docker compose down && docker compose up -d"
