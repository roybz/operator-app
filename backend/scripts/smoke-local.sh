#!/usr/bin/env bash
set -euo pipefail

if ! command -v sam >/dev/null; then
  echo "SAM CLI is required. Install it from https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html" >&2
  exit 1
fi

if ! command -v docker >/dev/null; then
  echo "Docker is required for sam local. Please install and start Docker." >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)

cd "${ROOT_DIR}"

sam build
sam local start-api --host 127.0.0.1 --port 3000 >/tmp/operator-app-sam-local.log 2>&1 &
SAM_PID=$!

cleanup() {
  kill "${SAM_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 3

base_url="http://127.0.0.1:3000"

curl -sS "${base_url}/todos" >/dev/null

create_resp=$(curl -sS -X POST "${base_url}/todos" -H 'Content-Type: application/json' -d '{"text":"Smoke item"}')
item_id=$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.id);" "${create_resp}")

curl -sS -X DELETE "${base_url}/todos/${item_id}" >/dev/null

echo "Smoke test complete."
