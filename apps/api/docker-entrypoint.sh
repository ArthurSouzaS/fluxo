#!/bin/sh
set -e

echo "Aplicando migrations..."
npx prisma migrate deploy

if [ "$SEED_ON_START" = "true" ]; then
  echo "Populando o banco com dados de exemplo (se estiver vazio)..."
  npx tsx prisma/seed.ts --if-empty
fi

exec node dist/server.js
