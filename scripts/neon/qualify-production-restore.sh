#!/usr/bin/env bash
set -euo pipefail

: "${NEON_API_KEY:?NEON_API_KEY is required}"
: "${NEON_PROJECT_ID:?NEON_PROJECT_ID is required}"
: "${PRODUCTION_BRANCH_ID:?PRODUCTION_BRANCH_ID is required}"
: "${FREE_HISTORY_SECONDS:?FREE_HISTORY_SECONDS is required}"
: "${FREE_BRANCH_LIMIT:?FREE_BRANCH_LIMIT is required}"
: "${SOURCE_MINUTES_AGO:?SOURCE_MINUTES_AGO is required}"

RESTORE_BRANCH_ID=""
RESTORE_BRANCH_NAME="dr-pitr-${GITHUB_RUN_ID:-manual}"
API_PID=""
STARTED_EPOCH="$(date +%s)"
SOURCE_TIMESTAMP="$(date -u -d "${SOURCE_MINUTES_AGO} minutes ago" +'%Y-%m-%dT%H:%M:%S.000Z')"
RTO_SECONDS=""
SCHEMA_COMPARE_STATUS="not-run"

cleanup() {
  local original_status=$?
  trap - EXIT
  set +e

  if [[ -n "$API_PID" ]]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi

  local cleanup_failed=0
  if [[ -n "$RESTORE_BRANCH_ID" ]]; then
    branch_json="$(curl -fsS -H "Authorization: Bearer ${NEON_API_KEY}" \
      "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${RESTORE_BRANCH_ID}" 2>/dev/null)" || cleanup_failed=1

    if [[ "$cleanup_failed" == "0" ]]; then
      [[ "$(jq -r '.branch.name' <<<"$branch_json")" == "$RESTORE_BRANCH_NAME" ]] || cleanup_failed=1
      [[ "$(jq -r '.branch.parent_id' <<<"$branch_json")" == "$PRODUCTION_BRANCH_ID" ]] || cleanup_failed=1
      [[ "$RESTORE_BRANCH_ID" != "$PRODUCTION_BRANCH_ID" ]] || cleanup_failed=1
    fi

    if [[ "$cleanup_failed" == "0" ]]; then
      curl -fsS -X DELETE \
        -H "Authorization: Bearer ${NEON_API_KEY}" \
        "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${RESTORE_BRANCH_ID}" >/dev/null || cleanup_failed=1
    fi

    if [[ "$cleanup_failed" == "0" ]]; then
      branches_json="$(curl -fsS -H "Authorization: Bearer ${NEON_API_KEY}" \
        "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches")" || cleanup_failed=1
      remaining="$(jq --arg id "$RESTORE_BRANCH_ID" '[.branches[] | select(.id == $id)] | length' <<<"$branches_json")"
      [[ "$remaining" == "0" ]] || cleanup_failed=1
    fi

    if [[ "$cleanup_failed" == "0" ]]; then
      echo "Temporary restore branch cleanup verified."
    else
      echo "Temporary restore branch cleanup could not be fully verified." >&2
    fi
  fi

  if [[ "$original_status" != "0" ]]; then
    exit "$original_status"
  fi
  if [[ "$cleanup_failed" != "0" ]]; then
    exit 1
  fi
  exit 0
}
trap cleanup EXIT

harden_connection_uri() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
uri = urlsplit(sys.argv[1])
query = [(k, v) for k, v in parse_qsl(uri.query, keep_blank_values=True) if k.lower() != 'sslmode']
query.append(('sslmode', 'verify-full'))
print(urlunsplit((uri.scheme, uri.netloc, uri.path, urlencode(query), uri.fragment)))
PY
}

connection_uri() {
  local branch_id="$1"
  local role_name="$2"
  local raw_uri
  raw_uri="$(curl -fsSG \
    -H "Authorization: Bearer ${NEON_API_KEY}" \
    --data-urlencode "branch_id=${branch_id}" \
    --data-urlencode 'database_name=neondb' \
    --data-urlencode "role_name=${role_name}" \
    --data-urlencode 'pooled=false' \
    "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/connection_uri" | jq -er '.uri')"
  echo "::add-mask::$raw_uri" >&2
  harden_connection_uri "$raw_uri"
}

project_json="$(curl -fsS -H "Authorization: Bearer ${NEON_API_KEY}" \
  "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}")"
branches_json="$(curl -fsS -H "Authorization: Bearer ${NEON_API_KEY}" \
  "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches")"

production_json="$(jq -ec --arg id "$PRODUCTION_BRANCH_ID" '[.branches[] | select(.id == $id)][0]' <<<"$branches_json")"
[[ "$(jq -r '.name' <<<"$production_json")" == "production" ]]
[[ "$(jq -r '.default' <<<"$production_json")" == "true" ]]
[[ -z "$(jq -r '.parent_id // ""' <<<"$production_json")" ]]

history_seconds="$(jq -er '.project.history_retention_seconds' <<<"$project_json")"
[[ "$history_seconds" -ge "$FREE_HISTORY_SECONDS" ]] || {
  echo "Restore qualification blocked: history window is ${history_seconds}s." >&2
  exit 1
}

branch_count="$(jq '.branches | length' <<<"$branches_json")"
[[ "$branch_count" -lt "$FREE_BRANCH_LIMIT" ]] || {
  echo "Restore qualification blocked: ${branch_count}/${FREE_BRANCH_LIMIT} branches already exist." >&2
  exit 1
}

echo "Canonical Production verified; history=${history_seconds}s, branches=${branch_count}/${FREE_BRANCH_LIMIT}."

payload="$(jq -cn \
  --arg name "$RESTORE_BRANCH_NAME" \
  --arg parent "$PRODUCTION_BRANCH_ID" \
  --arg timestamp "$SOURCE_TIMESTAMP" \
  '{branch:{name:$name,parent_id:$parent,parent_timestamp:$timestamp},endpoints:[{type:"read_write"}]}')"
response="$(curl -fsS -X POST \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d "$payload" \
  "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches")"
RESTORE_BRANCH_ID="$(jq -er '.branch.id' <<<"$response")"
[[ "$(jq -er '.branch.parent_id' <<<"$response")" == "$PRODUCTION_BRANCH_ID" ]]
echo "Historical restore branch created at ${SOURCE_TIMESTAMP}."

ADMIN_DATABASE_URL="$(connection_uri "$RESTORE_BRANCH_ID" neondb_owner)"
MIGRATOR_DATABASE_URL="$(connection_uri "$RESTORE_BRANCH_ID" nexora_migrator)"
APP_DATABASE_URL="$(connection_uri "$RESTORE_BRANCH_ID" nexora_app)"
for value in "$ADMIN_DATABASE_URL" "$MIGRATOR_DATABASE_URL" "$APP_DATABASE_URL"; do
  echo "::add-mask::$value"
  [[ "$value" == *'sslmode=verify-full'* ]]
done

if [[ "$MIGRATOR_DATABASE_URL" == *'?'* ]]; then
  OWNER_DATABASE_URL="${MIGRATOR_DATABASE_URL}&options=-c%20role%3Dnexora_owner"
else
  OWNER_DATABASE_URL="${MIGRATOR_DATABASE_URL}?options=-c%20role%3Dnexora_owner"
fi
echo "::add-mask::$OWNER_DATABASE_URL"

ready=false
for attempt in $(seq 1 30); do
  if psql "$ADMIN_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc 'select 1' >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
[[ "$ready" == "true" ]] || { echo "Restored database did not become queryable." >&2; exit 1; }

conninfo="$(psql "$ADMIN_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c '\conninfo' 2>&1)"
grep -Eq 'SSL connection \(protocol: TLSv1\.[23], cipher: [^,)]+' <<<"$conninfo" || {
  echo "Restored database connection did not prove TLSv1.2/TLSv1.3 with cipher." >&2
  exit 1
}
RTO_SECONDS="$(( $(date +%s) - STARTED_EPOCH ))"
echo "Restored database became queryable in ${RTO_SECONDS}s."

expected="$(jq '.entries | length' packages/database/migrations/meta/_journal.json)"
actual="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc 'select count(*) from drizzle.__drizzle_migrations;')"
[[ "$actual" == "$expected" ]] || {
  echo "Restored migration ledger mismatch: ${actual}/${expected}." >&2
  exit 1
}

posture="$(psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "
  select count(*) from pg_roles
   where (rolname = 'nexora_owner' and rolcanlogin = false and rolsuper = false and rolbypassrls = false and rolcreatedb = false and rolcreaterole = false)
      or (rolname in ('nexora_migrator','nexora_app','nexora_worker') and rolcanlogin = true and rolsuper = false and rolbypassrls = false and rolcreatedb = false and rolcreaterole = false);")"
[[ "$posture" == "4" ]] || { echo "Restored role posture mismatch." >&2; exit 1; }

psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/ci/wave-0024-audit-schema.sql
psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/ci/wave-0024-audit-immutability.sql
psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/ci/wave-0024-audit-runtime.sql

echo "Restored branch verified: ledger ${actual}/${expected}, minimum-privilege roles, Audit immutability and runtime RLS."

schema_http="$(curl -sS -o /tmp/nexora-schema-compare.json -w '%{http_code}' -G \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  --data-urlencode "base_branch_id=${PRODUCTION_BRANCH_ID}" \
  --data-urlencode 'db_name=neondb' \
  "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${RESTORE_BRANCH_ID}/compare_schema")"
case "$schema_http" in
  200)
    schema_diff_present="$(jq -r 'if (.diff // "") == "" then "false" else "true" end' /tmp/nexora-schema-compare.json)"
    [[ "$schema_diff_present" == "false" ]] || {
      echo "Neon schema comparison reports drift between restored point and current Production." >&2
      exit 1
    }
    SCHEMA_COMPARE_STATUS="pass"
    ;;
  413)
    SCHEMA_COMPARE_STATUS="provider-413"
    echo "Neon compare_schema returned HTTP 413; using exact migration ledger plus executable schema/Audit/RLS gates as authoritative restore validation."
    ;;
  *)
    echo "Neon compare_schema returned unexpected HTTP ${schema_http}." >&2
    exit 1
    ;;
esac

pnpm --filter @nexora/api build
DATABASE_URL="$APP_DATABASE_URL" \
PORT=3101 \
APP_ENV=dr-restore \
NODE_ENV=test \
OIDC_PROVIDER_KEY=restore-gate \
OIDC_ISSUER_URL=https://restore.invalid/ \
OIDC_JWKS_URL=https://restore.invalid/.well-known/jwks.json \
OIDC_AUDIENCE=urn:nexora:tms:api:restore \
pnpm --filter @nexora/api start > /tmp/nexora-dr-api.log 2>&1 &
API_PID=$!

api_ready=false
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3101/health/ready >/tmp/readiness.json 2>/dev/null; then
    api_ready=true
    break
  fi
  sleep 1
done
if [[ "$api_ready" != "true" ]]; then
  cat /tmp/nexora-dr-api.log >&2
  exit 1
fi

curl -fsS http://127.0.0.1:3101/health/live >/dev/null
headers="$(curl -fsS -D - -o /dev/null -H 'x-correlation-id: dr-restore-gate' http://127.0.0.1:3101/health)"
grep -qi '^x-correlation-id: dr-restore-gate' <<<"$headers"
grep -qi '^x-content-type-options: nosniff' <<<"$headers"
status="$(curl -sS -o /tmp/negative-auth.json -w '%{http_code}' http://127.0.0.1:3101/api/v1/documents)"
[[ "$status" == "401" ]] || { echo "Expected negative auth HTTP 401, found ${status}." >&2; exit 1; }
echo "Restored API smoke passed: liveness, database readiness, correlation/security headers and fail-closed auth."

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo '## Neon Production restore qualification'
    echo ''
    echo "- Source branch: production (${PRODUCTION_BRANCH_ID})"
    echo "- Historical source timestamp: ${SOURCE_TIMESTAMP}"
    echo "- Tested recovery-point lag (RPO exercise): $(( SOURCE_MINUTES_AGO * 60 )) seconds"
    echo "- Database-ready RTO: ${RTO_SECONDS} seconds"
    echo "- Free history window: ${history_seconds} seconds"
    echo "- Migration ledger: ${actual}/${expected}"
    echo '- Minimum-privilege roles, Audit immutability and runtime RLS: PASS'
    echo "- Neon compare_schema: ${SCHEMA_COMPARE_STATUS}"
    echo '- API liveness/readiness, correlation/security headers and negative auth: PASS'
    echo '- Production branch was not modified.'
    echo '- Temporary recovery branch is deleted by the guarded EXIT cleanup.'
  } >> "$GITHUB_STEP_SUMMARY"
fi
