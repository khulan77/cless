#!/usr/bin/env bash
# Backup-аас DB (+ сонголтоор uploads) сэргээнэ.
#
#   scripts/restore.sh backups/cless-20261127-030000.dump [--uploads backups/uploads-20261127-030000.tar.gz] [--yes]
#
# Сервер (host) дээр ажиллуулахад: app, worker-ийг зогсоож → `backup` container дотор сэргээж →
# дахин асаана. Сэргээхээс өмнө одоогийн DB-г backups/pre-restore-*.dump болгон хадгална.
#
# ⚠️ DB-ийн `public` schema-г БҮХЭЛД нь устгаж backup-ийн төлөвт оруулна (backup-аас хойшхи
# өгөгдөл алга болно). Зөвхөн compose-ийн локал `db`-д зориулсан; Supabase-д түүний хэрэгслийг ашигла.
set -euo pipefail

usage() { echo "Хэрэглээ: $0 <file.dump> [--uploads <uploads.tar.gz>] [--yes]" >&2; exit 2; }

DUMP="" UPLOADS="" YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --uploads) UPLOADS="${2:-}"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    -h|--help) usage ;;
    *) [ -z "$DUMP" ] && DUMP="$1" || usage; shift ;;
  esac
done
[ -n "$DUMP" ] || usage

# ───────────── host горим: container руу дамжуулна ─────────────
if [ ! -f /.dockerenv ]; then
  cd "$(dirname "$0")/.."
  DC=(docker compose --env-file .env.production -f docker-compose.prod.yml)
  for f in "$DUMP" ${UPLOADS:+"$UPLOADS"}; do
    [ -f "$f" ] || { echo "Файл олдсонгүй: $f" >&2; exit 1; }
    case "$(realpath "$f")" in "$(pwd)/backups/"*) ;; *) echo "Файл backups/ хавтаст байх ёстой: $f" >&2; exit 1 ;; esac
  done
  if [ "$YES" -ne 1 ]; then
    read -r -p "DB-г '$(basename "$DUMP")'-ийн төлөвт оруулна. Одоогийн өгөгдөл солигдоно. Үргэлжлүүлэх үү? (yes/no) " ans
    [ "$ans" = "yes" ] || { echo "Цуцаллаа."; exit 1; }
  fi
  echo "→ app, worker зогсоож байна"
  "${DC[@]}" stop app worker
  set +e
  "${DC[@]}" run --rm --no-deps -T backup /scripts/restore.sh "/backups/$(basename "$DUMP")" \
    ${UPLOADS:+--uploads "/backups/$(basename "$UPLOADS")"} --yes
  rc=$?
  set -e
  echo "→ app, worker асааж байна"
  "${DC[@]}" start app worker
  exit $rc
fi

# ───────────── container горим ─────────────
URL="${DIRECT_URL:-${DATABASE_URL:-}}"
[ -n "$URL" ] || { echo "DATABASE_URL тохируулагдаагүй" >&2; exit 1; }
URL=$(printf '%s' "$URL" | sed -E 's/([?&])(pgbouncer|connection_limit|pool_timeout|schema)=[^&]*&?/\1/g; s/[?&]$//')
[ -f "$DUMP" ] || { echo "Файл олдсонгүй: $DUMP" >&2; exit 1; }
pg_restore --list "$DUMP" > /dev/null || { echo "Backup файл гэмтсэн байна: $DUMP" >&2; exit 1; }
[ "$YES" -eq 1 ] || { echo "--yes шаардлагатай (container горим)" >&2; exit 2; }

SAFETY="${BACKUP_DIR:-/backups}/pre-restore-$(date +%Y%m%d-%H%M%S).dump"
echo "→ Одоогийн DB-г хадгалж байна: $SAFETY"
pg_dump --format=custom --no-owner --no-privileges --dbname="$URL" --file="$SAFETY"

echo "→ Сэргээж байна: $DUMP"
psql "$URL" -v ON_ERROR_STOP=1 -q -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
if ! pg_restore --no-owner --no-privileges --exit-on-error --single-transaction --dbname="$URL" "$DUMP"; then
  echo "✗ Сэргээлт амжилтгүй. Өмнөх төлөвт буцааж байна: $SAFETY" >&2
  psql "$URL" -v ON_ERROR_STOP=1 -q -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
  pg_restore --no-owner --no-privileges --single-transaction --dbname="$URL" "$SAFETY"
  exit 1
fi

if [ -n "$UPLOADS" ]; then
  [ -d /uploads ] || { echo "/uploads volume холбогдоогүй" >&2; exit 1; }
  echo "→ Зургуудыг сэргээж байна: $UPLOADS"
  tar -tzf "$UPLOADS" > /dev/null
  find /uploads -mindepth 1 -delete
  tar -xzf "$UPLOADS" -C /uploads
  chown -R 1000:1000 /uploads   # app container-ийн `node` хэрэглэгч
fi

echo "→ Шалгалт (мөрийн тоо):"
psql "$URL" -At -F ' ' -c "SELECT 'Product', count(*) FROM \"Product\" UNION ALL SELECT 'Variant', count(*) FROM \"Variant\" UNION ALL SELECT 'Sale', count(*) FROM \"Sale\" UNION ALL SELECT 'User', count(*) FROM \"User\" UNION ALL SELECT '_prisma_migrations', count(*) FROM _prisma_migrations"
echo "✓ Сэргээлт дууслаа"
