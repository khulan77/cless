#!/usr/bin/env bash
# Өдөр бүр BACKUP_AT (default 03:00, TZ=Asia/Ulaanbaatar) цагт /scripts/backup.sh ажиллуулна.
set -uo pipefail

AT="${BACKUP_AT:-03:00}"
log() { echo "[backup $(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }

# Хуваарийг systemd timer / cron (deploy/systemd/) хийж байвал container зөвхөн хүлээнэ —
# `docker compose exec backup /scripts/backup.sh`-д бэлэн байна. Хоёр давхар ажиллуулахгүй.
if [ "$AT" = "off" ]; then
  log "BACKUP_AT=off — хуваарийг гаднаас (systemd timer/cron) ажиллуулна"
  exec sleep infinity
fi

log "эхэллээ — өдөр бүр ${AT}"
while true; do
  now=$(date +%s)
  next=$(date -d "today ${AT}" +%s)
  [ "$next" -le "$now" ] && next=$(date -d "tomorrow ${AT}" +%s)
  log "дараагийн backup: $(date -d "@${next}" '+%Y-%m-%d %H:%M %Z')"
  sleep $((next - now))
  if /scripts/backup.sh; then log "амжилттай"; else log "АЛДАА (код $?)"; fi
done
