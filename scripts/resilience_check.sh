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

echo "1) Restart backend and verify recovery"
docker compose -f docker-compose.app.yml restart backend
sleep 5
curl -fsS http://127.0.0.1:5173/api/health >/dev/null

echo "2) Temporary dependency failure (minio down/up)"
docker compose -f docker-compose.app.yml stop minio
sleep 3
docker compose -f docker-compose.app.yml start minio

for _ in {1..30}; do
  status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' production-minio 2>/dev/null || true)
  if [[ "$status" == "healthy" ]]; then
    break
  fi
  sleep 2
done

echo "3) Backend still healthy after dependency recovery"
curl -fsS http://127.0.0.1:5173/api/health >/dev/null

echo "Resilience check passed"
