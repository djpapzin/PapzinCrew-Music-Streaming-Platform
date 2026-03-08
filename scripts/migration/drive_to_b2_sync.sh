#!/usr/bin/env bash
set -Eeuo pipefail

# Drive -> Backblaze B2 sync using rclone
# Safe defaults: resumable, retry-aware, and logs to logs/migration/*.log

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs/migration"
mkdir -p "${LOG_DIR}"

TS="$(date -u +"%Y%m%dT%H%M%SZ")"
LOG_FILE="${LOG_DIR}/drive_to_b2_sync_${TS}.log"

# Configurable via env vars (no secrets hardcoded)
DRIVE_REMOTE="${DRIVE_REMOTE:-gdrive}"
DRIVE_PATH="${DRIVE_PATH:-PapzinCrewUploads}"
B2_REMOTE="${B2_REMOTE:-b2}"
B2_BUCKET="${B2_BUCKET:-papzincrew}"
B2_PREFIX="${B2_PREFIX:-audio/migration}"

# Retry / resilience tuning
RCLONE_TRANSFERS="${RCLONE_TRANSFERS:-8}"
RCLONE_CHECKERS="${RCLONE_CHECKERS:-16}"
RCLONE_RETRIES="${RCLONE_RETRIES:-12}"
RCLONE_LOW_LEVEL_RETRIES="${RCLONE_LOW_LEVEL_RETRIES:-32}"
RCLONE_RETRY_SLEEP="${RCLONE_RETRY_SLEEP:-10s}"
RCLONE_TIMEOUT="${RCLONE_TIMEOUT:-5m}"
RCLONE_CONTIMEOUT="${RCLONE_CONTIMEOUT:-30s}"
RCLONE_STATS_INTERVAL="${RCLONE_STATS_INTERVAL:-30s}"
RCLONE_BWLIMIT="${RCLONE_BWLIMIT:-off}" # e.g. 8M

SRC="${DRIVE_REMOTE}:${DRIVE_PATH}"
DST="${B2_REMOTE}:${B2_BUCKET}/${B2_PREFIX}"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "[$(date -u +"%F %T UTC")] Starting Drive -> B2 sync"
echo "Source      : ${SRC}"
echo "Destination : ${DST}"
echo "Log file    : ${LOG_FILE}"

if ! command -v rclone >/dev/null 2>&1; then
  echo "ERROR: rclone is not installed or not in PATH."
  exit 1
fi

rclone version

# Optional remote sanity checks (does not expose secrets)
rclone lsd "${DRIVE_REMOTE}:" >/dev/null
rclone lsd "${B2_REMOTE}:" >/dev/null

# --retries/--low-level-retries + --ignore-existing make this retry-safe.
# Remove --ignore-existing if you need to update changed source files.
rclone sync "${SRC}" "${DST}" \
  --progress \
  --stats-one-line \
  --stats "${RCLONE_STATS_INTERVAL}" \
  --transfers "${RCLONE_TRANSFERS}" \
  --checkers "${RCLONE_CHECKERS}" \
  --retries "${RCLONE_RETRIES}" \
  --low-level-retries "${RCLONE_LOW_LEVEL_RETRIES}" \
  --retries-sleep "${RCLONE_RETRY_SLEEP}" \
  --timeout "${RCLONE_TIMEOUT}" \
  --contimeout "${RCLONE_CONTIMEOUT}" \
  --tpslimit 8 \
  --ignore-existing \
  --fast-list \
  --checksum \
  --create-empty-src-dirs \
  --track-renames \
  --use-server-modtime \
  --metadata \
  --b2-hard-delete \
  --bwlimit "${RCLONE_BWLIMIT}"

# Emit post-sync inventory for deterministic manifest building
LSJSON_OUT="${LOG_DIR}/b2_lsjson_${TS}.json"
LSF_OUT="${LOG_DIR}/b2_lsf_${TS}.txt"
rclone lsjson -R "${DST}" > "${LSJSON_OUT}"
rclone lsf -R "${DST}" > "${LSF_OUT}"

echo "[$(date -u +"%F %T UTC")] Sync complete"
echo "Inventory (json): ${LSJSON_OUT}"
echo "Inventory (lsf) : ${LSF_OUT}"
