#!/usr/bin/env bash
# DB (+ uploads) backup нэг удаа авна. `backup` container дотор ажиллана:
#   docker compose --env-file .env.production -f docker-compose.prod.yml exec backup /scripts/backup.sh
#
# Орчны хувьсагч:
#   DIRECT_URL | DATABASE_URL   — холболт (DIRECT_URL-ийг түрүүлж ашиглана; pooler биш)
#   BACKUP_DIR=/backups, BACKUP_KEEP_DAYS=14
#   BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY,
#   BACKUP_S3_REGION (сонголттой), BACKUP_S3_PREFIX (default "cless")
set -euo pipefail

DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
URL="${DIRECT_URL:-${DATABASE_URL:-}}"
[ -n "$URL" ] || { echo "DATABASE_URL тохируулагдаагүй" >&2; exit 1; }
# libpq танихгүй Prisma-гийн параметрүүдийг хасна
URL=$(printf '%s' "$URL" | sed -E 's/([?&])(pgbouncer|connection_limit|pool_timeout|schema)=[^&]*&?/\1/g; s/[?&]$//')

mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
DUMP="$DIR/cless-$STAMP.dump"

# custom format (-Fc): шахагдсан, pg_restore-оор сонгон сэргээж болно
pg_dump --format=custom --no-owner --no-privileges --dbname="$URL" --file="$DUMP.partial"
pg_restore --list "$DUMP.partial" > /dev/null   # файл бүрэн эсэхийг шалгана
mv "$DUMP.partial" "$DUMP"
echo "DB: $DUMP ($(du -h "$DUMP" | cut -f1))"

# Админаас оруулсан зургууд (volume байвал)
if [ -d /uploads ] && [ -n "$(ls -A /uploads 2>/dev/null)" ]; then
  UP="$DIR/uploads-$STAMP.tar.gz"
  tar -czf "$UP.partial" -C /uploads . && mv "$UP.partial" "$UP"
  echo "Uploads: $UP ($(du -h "$UP" | cut -f1))"
fi

# Хадгалах хугацаа
find "$DIR" -maxdepth 1 -type f \( -name 'cless-*.dump' -o -name 'uploads-*.tar.gz' \) -mmin +$((KEEP * 1440)) -print -delete

# S3-compatible (сонголттой)
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  export RCLONE_CONFIG_REMOTE_TYPE=s3
  export RCLONE_CONFIG_REMOTE_PROVIDER=Other
  export RCLONE_CONFIG_REMOTE_ENDPOINT="${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT}"
  export RCLONE_CONFIG_REMOTE_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:?BACKUP_S3_ACCESS_KEY_ID}"
  export RCLONE_CONFIG_REMOTE_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:?BACKUP_S3_SECRET_ACCESS_KEY}"
  export RCLONE_CONFIG_REMOTE_REGION="${BACKUP_S3_REGION:-auto}"
  DEST="remote:${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-cless}"
  rclone copy "$DIR" "$DEST" --include "*-$STAMP.*" --s3-no-check-bucket
  echo "S3: $DEST руу хуулагдлаа"
fi
