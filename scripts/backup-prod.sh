#!/usr/bin/env bash
# Daily backup of Globo's two databases (Globo and Traccar) on the production server.
# Each dump is encrypted with age to a public key whose private half is kept off the
# server, so a copy taken from here can't be read. With BACKUP_RCLONE_REMOTE set, the
# copy is also sent off the server. Settings: backup.env next to docker-compose.prod.yml.
# Restore: docs/despliegue.md
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=/dev/null
source ./backup.env
: "${BACKUP_AGE_RECIPIENT:?}" "${BACKUP_DIR:?}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
trap 'log "FAIL (line $LINENO)"' ERR

# One run at a time
exec 9>/run/globo-backup.lock
flock -n 9 || { log "another backup is running"; exit 1; }

TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$BACKUP_DIR/$TS"
mkdir -p "$OUT"
chmod 700 "$BACKUP_DIR" "$OUT"
C="docker compose -f docker-compose.prod.yml --env-file .env.production"

log "start $TS"
for spec in "db globo" "traccar-db traccar"; do
  read -r service name <<<"$spec"
  $C exec -T "$service" pg_dump -U "$name" -d "$name" --format=custom \
    | age -r "$BACKUP_AGE_RECIPIENT" > "$OUT/$name.dump.age"
  log "$name: $(stat -c%s "$OUT/$name.dump.age") bytes"
done
(cd "$OUT" && sha256sum ./*.age > SHA256SUMS)

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  rclone copy "$OUT" "$BACKUP_RCLONE_REMOTE/$TS"
  rclone delete --min-age "${KEEP_DAYS}d" "$BACKUP_RCLONE_REMOTE"
  rclone rmdirs --leave-root "$BACKUP_RCLONE_REMOTE"
  log "sent to $BACKUP_RCLONE_REMOTE"
else
  log "WARNING: BACKUP_RCLONE_REMOTE not set, the copy stays on this server only"
fi

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
date -u +%Y-%m-%dT%H:%M:%SZ > "$BACKUP_DIR/last-success"
log "done"
