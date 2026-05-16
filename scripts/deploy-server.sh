#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-/etc/waymail/portal.env}"
PORTAL_SERVICE="${PORTAL_SERVICE:-waymail-portal}"
WORKER_SERVICE="${WORKER_SERVICE:-waymail-worker}"
RUN_TESTS="${RUN_TESTS:-false}"
RESTART_WORKER="${RESTART_WORKER:-auto}"

echo "Deploying application from: $APP_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Expected environment file is missing: $ENV_FILE"
  exit 1
fi

APP_DIR="$APP_DIR" ENV_FILE="$ENV_FILE" RUN_TESTS="$RUN_TESTS" bash "$SCRIPT_DIR/install-server.sh"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl was not found. Build finished, but services were not restarted."
  exit 0
fi

echo "Reloading systemd units..."
sudo systemctl daemon-reload

if systemctl list-unit-files | grep -q "^${PORTAL_SERVICE}\.service"; then
  echo "Restarting ${PORTAL_SERVICE}..."
  sudo systemctl restart "$PORTAL_SERVICE"
  sudo systemctl status "$PORTAL_SERVICE" --no-pager
else
  echo "Portal service ${PORTAL_SERVICE}.service was not found. Skipping restart."
fi

should_restart_worker="false"
if [ "$RESTART_WORKER" = "true" ]; then
  should_restart_worker="true"
elif [ "$RESTART_WORKER" = "auto" ] && systemctl list-unit-files | grep -q "^${WORKER_SERVICE}\.service"; then
  should_restart_worker="true"
fi

if [ "$should_restart_worker" = "true" ]; then
  echo "Restarting ${WORKER_SERVICE}..."
  sudo systemctl restart "$WORKER_SERVICE"
  sudo systemctl status "$WORKER_SERVICE" --no-pager || true
else
  echo "Worker restart skipped."
fi

echo "Deployment completed."
