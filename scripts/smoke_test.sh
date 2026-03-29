#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f ".env" ]]; then
  echo ".env not found"
  exit 1
fi

set -a
source .env
set +a

docker compose -f docker-compose.app.yml up -d

echo "Waiting for frontend health..."
for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:5173 >/dev/null; then
    break
  fi
  sleep 2
done

echo "Checking frontend..."
curl -fsS http://127.0.0.1:5173 >/dev/null

echo "Checking backend health via reverse proxy..."
curl -fsS http://127.0.0.1:5173/api/health

echo "Checking backend direct health in compose network..."
docker compose -f docker-compose.app.yml exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"

echo "Smoke test passed"
