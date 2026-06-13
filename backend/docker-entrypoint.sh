#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

npm run prisma:deploy --workspace @fatboy-pos/backend

if [ "${SKIP_BASE_IMPORT:-false}" != "true" ]; then
  node backend/dist/scripts/import-base-catalog.js --if-empty
fi

exec node backend/dist/src/main.js
