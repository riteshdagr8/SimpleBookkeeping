#!/usr/bin/env bash
# docker-entrypoint.sh - run migrations + seed, then start the Next.js standalone server.
set -euo pipefail

# Resolve the absolute DATABASE_URL so Prisma and seed scripts agree on the file path.
DATABASE_URL="${DATABASE_URL:-file:/app/data/app.db}"
if [[ "$DATABASE_URL" == file:* ]]; then
  raw="${DATABASE_URL#file:}"
  if [[ ! "$raw" == /* ]]; then
    raw="$(pwd)/$raw"
  fi
  DATABASE_URL="file:$raw"
fi
export DATABASE_URL

echo "DATABASE_URL -> $DATABASE_URL"

PRISMA="$(pwd)/node_modules/.bin/prisma"

if [ ! -x "$PRISMA" ]; then
  echo "Prisma CLI not found at $PRISMA"
  exit 1
fi

echo "Running Prisma migrate deploy..."
"$PRISMA" migrate deploy

echo "Seeding default tenant and users (if missing)..."
"$PRISMA" db seed

echo "Starting Next.js standalone server..."
exec node server.js
