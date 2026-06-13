#!/bin/sh
set -eu

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if [ -d "backend/dist" ]; then
  APP_DIR="backend"
else
  APP_DIR="."
fi

if [ -z "${BASE_DATA_DIR:-}" ]; then
  if [ "$APP_DIR" = "backend" ]; then
    export BASE_DATA_DIR="backend/base"
  else
    export BASE_DATA_DIR="base"
  fi
fi

DATABASE_WAIT_RETRIES="${DATABASE_WAIT_RETRIES:-30}"
DATABASE_WAIT_SECONDS="${DATABASE_WAIT_SECONDS:-5}"
attempt=1

while ! npm --prefix "$APP_DIR" run prisma:deploy; do
  if [ "$attempt" -ge "$DATABASE_WAIT_RETRIES" ]; then
    echo "Database is still unreachable after ${DATABASE_WAIT_RETRIES} attempts." >&2
    echo "Check DATABASE_URL host, port, credentials, and Coolify service networking." >&2
    exit 1
  fi

  echo "Database is not reachable yet. Retry ${attempt}/${DATABASE_WAIT_RETRIES} in ${DATABASE_WAIT_SECONDS}s..."
  attempt=$((attempt + 1))
  sleep "$DATABASE_WAIT_SECONDS"
done

if [ "${SKIP_BASE_IMPORT:-false}" != "true" ]; then
  node "$APP_DIR/dist/scripts/import-base-catalog.js" --if-empty
fi

exec node "$APP_DIR/dist/src/main.js"
