#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-/etc/waymail/portal.env}"
RUN_TESTS="${RUN_TESTS:-true}"

echo "Installing server dependencies in: $APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found in PATH."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found in PATH."
  exit 1
fi

if [ ! -f "$APP_DIR/package.json" ]; then
  echo "package.json not found in $APP_DIR"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Expected environment file is missing: $ENV_FILE"
  echo "Create it before deploying so services can start cleanly."
  exit 1
fi

cd "$APP_DIR"

echo "Running npm install..."
npm install

echo "Running build..."
npm run build

if [ "$RUN_TESTS" = "true" ]; then
  echo "Running tests..."
  npm test
fi

echo "Server install completed successfully."
