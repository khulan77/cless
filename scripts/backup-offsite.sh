#!/usr/bin/env bash
# Backup-ийг серверээс ГАДАГШ (S3-compatible эсвэл Backblaze B2) хуулах, хадгалах хугацаа, татах.
# `backup` container дотор ажиллана (rclone суусан). backup.sh өдөр бүр `push`-ийг дуудна.
#
#   backup-offsite.sh push <STAMP>      # <BACKUP_DIR>/*-<STAMP>.* → daily/ (+ долоо хоногийн өдөр бол weekly/), prune
#   backup-offsite.sh list [daily|weekly]
#   backup-offsite.sh fetch <daily|weekly>/<файл> [<dir>]   # гамшгийн үед шинэ сервер рүү татах
#   backup-offsite.sh check             # холболт, эрх шалгах (жижиг файл бичиж/уншиж/устгана)
#
# Тохиргоо (.env.production):
#   BACKUP_REMOTE            s3 | b2 | (хоосон = гадагш хуулахгүй)
#   BACKUP_REMOTE_BUCKET     bucket нэр
#   BACKUP_REMOTE_PREFIX     bucket доторх хавтас (default: cless)
#   ── s3 (Cloudflare R2, Wasabi, AWS, MinIO г.м.)
#   BACKUP_S3_ENDPOINT, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY, BACKUP_S3_REGION (default auto),
#   BACKUP_S3_PROVIDER (default Other; Cloudflare|AWS|Wasabi|Minio …)
#   ── b2
#   BACKUP_B2_ACCOUNT_ID (keyID), BACKUP_B2_APPLICATION_KEY
#   ── шифрлэлт (сонголттой, ЗӨВЛӨЖ БАЙНА — харилцагчийн хувийн мэдээлэл гуравдагч storage-д)
#   BACKUP_ENCRYPT_PASSWORD  энгийн текст нууц үг (АЛДВАЛ backup-ийг сэргээх БОЛОМЖГҮЙ)
#   ── хадгалах хугацаа
#   BACKUP_REMOTE_KEEP_DAYS (default 14), BACKUP_REMOTE_KEEP_WEEKS (default 8),
#   BACKUP_WEEKLY_DOW (default 7 = Ням; `date +%u`)
set -euo pipefail

log() { echo "[offsite] $*"; }
die() { echo "[offsite] АЛДАА: $*" >&2; exit 1; }

REMOTE_KIND="${BACKUP_REMOTE:-}"
# Хуучин нэр (BACKUP_S3_BUCKET)-тэй нийцтэй
if [ -z "$REMOTE_KIND" ] && [ -n "${BACKUP_S3_BUCKET:-}" ]; then REMOTE_KIND=s3; fi
BUCKET="${BACKUP_REMOTE_BUCKET:-${BACKUP_S3_BUCKET:-}}"
PREFIX="${BACKUP_REMOTE_PREFIX:-${BACKUP_S3_PREFIX:-cless}}"
DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_REMOTE_KEEP_DAYS:-14}"
KEEP_WEEKS="${BACKUP_REMOTE_KEEP_WEEKS:-8}"
WEEKLY_DOW="${BACKUP_WEEKLY_DOW:-7}"

configure() {
  [ -n "$REMOTE_KIND" ] || { log "АНХААР: BACKUP_REMOTE тохируулаагүй — backup зөвхөн серверт (VPS устахад хамт устна)"; exit 0; }
  [ -n "$BUCKET" ] || die "BACKUP_REMOTE_BUCKET тохируулна уу"
  # Тохиргоо бүгд env-ээс; config файлгүй гэсэн NOTICE-ийг дарна
  export RCLONE_CONFIG="${TMPDIR:-/tmp}/rclone-empty.conf"
  : > "$RCLONE_CONFIG"
  case "$REMOTE_KIND" in
    s3)
      export RCLONE_CONFIG_STORE_TYPE=s3
      export RCLONE_CONFIG_STORE_PROVIDER="${BACKUP_S3_PROVIDER:-Other}"
      export RCLONE_CONFIG_STORE_ENDPOINT="${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT}"
      export RCLONE_CONFIG_STORE_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:?BACKUP_S3_ACCESS_KEY_ID}"
      export RCLONE_CONFIG_STORE_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:?BACKUP_S3_SECRET_ACCESS_KEY}"
      export RCLONE_CONFIG_STORE_REGION="${BACKUP_S3_REGION:-auto}"
      export RCLONE_CONFIG_STORE_NO_CHECK_BUCKET=true
      ;;
    b2)
      export RCLONE_CONFIG_STORE_TYPE=b2
      export RCLONE_CONFIG_STORE_ACCOUNT="${BACKUP_B2_ACCOUNT_ID:?BACKUP_B2_ACCOUNT_ID}"
      export RCLONE_CONFIG_STORE_KEY="${BACKUP_B2_APPLICATION_KEY:?BACKUP_B2_APPLICATION_KEY}"
      # Устгасан файлын хуучин хувилбарыг үлдээхгүй (retention жинхэнэ ажиллана)
      export RCLONE_CONFIG_STORE_HARD_DELETE=true
      ;;
    *) die "BACKUP_REMOTE буруу: '$REMOTE_KIND' (s3 эсвэл b2)" ;;
  esac
  if [ -n "${BACKUP_ENCRYPT_PASSWORD:-}" ]; then
    export RCLONE_CONFIG_OFFSITE_TYPE=crypt
    export RCLONE_CONFIG_OFFSITE_REMOTE="store:${BUCKET}/${PREFIX}"
    RCLONE_CONFIG_OFFSITE_PASSWORD=$(rclone obscure "$BACKUP_ENCRYPT_PASSWORD")
    export RCLONE_CONFIG_OFFSITE_PASSWORD
    ROOT="offsite:"
  else
    ROOT="store:${BUCKET}/${PREFIX}/"
  fi
}

push() {
  local stamp="${1:?STAMP}"
  shopt -s nullglob
  local files=("$DIR"/cless-"$stamp".dump "$DIR"/uploads-"$stamp".tar.gz)
  [ ${#files[@]} -gt 0 ] || die "$DIR-д *-$stamp.* файл алга"

  for f in "${files[@]}"; do
    rclone copyto "$f" "${ROOT}daily/$(basename "$f")" --retries 5 --low-level-retries 10
  done
  # Хуулсан файл бүрийн хэмжээг тулгана (алдаатай upload-ыг илрүүлнэ)
  for f in "${files[@]}"; do
    local want got
    want=$(stat -c %s "$f")
    got=$(rclone size --json "${ROOT}daily/$(basename "$f")" | sed -E 's/.*"bytes":([0-9]+).*/\1/')
    [ "$want" = "$got" ] || die "$(basename "$f"): хэмжээ таарахгүй (local $want, remote $got)"
  done
  log "daily/ ← ${#files[@]} файл (хэмжээ шалгагдсан)"

  if [ "$(date +%u)" = "$WEEKLY_DOW" ]; then
    for f in "${files[@]}"; do
      rclone copyto "${ROOT}daily/$(basename "$f")" "${ROOT}weekly/$(basename "$f")" --retries 5
    done
    log "weekly/ ← ${#files[@]} файл"
  fi
  prune
}

prune() {
  # rclone delete нь `--min-age`-ээс хуучин файлуудыг л устгана (шинэ backup-д хүрэхгүй)
  rclone delete "${ROOT}daily" --min-age "${KEEP_DAYS}d" --rmdirs 2>/dev/null || true
  rclone delete "${ROOT}weekly" --min-age "$((KEEP_WEEKS * 7))d" --rmdirs 2>/dev/null || true
  log "хадгалах хугацаа: daily ${KEEP_DAYS} хоног, weekly ${KEEP_WEEKS} долоо хоног"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  push) configure; push "$@" ;;
  prune) configure; prune ;;
  list) configure; rclone lsl "${ROOT}${1:-}" 2>/dev/null | sort -k2,3 ;;
  fetch)
    configure
    src="${1:?daily/<файл> эсвэл weekly/<файл>}"; dest="${2:-$DIR}"
    rclone copyto "${ROOT}${src}" "${dest}/$(basename "$src")" --retries 5
    log "татагдлаа: ${dest}/$(basename "$src")"
    ;;
  check)
    configure
    probe="_check-$(date +%s).txt"
    echo "ok $(date -Iseconds)" | rclone rcat "${ROOT}${probe}"
    [ "$(rclone cat "${ROOT}${probe}" | cut -d' ' -f1)" = ok ] || die "уншиж чадсангүй"
    rclone deletefile "${ROOT}${probe}"
    log "✓ ${REMOTE_KIND} (${BUCKET}/${PREFIX})$( [ -n "${BACKUP_ENCRYPT_PASSWORD:-}" ] && echo ', шифрлэгдсэн') — бичих/унших/устгах OK"
    ;;
  *) echo "Хэрэглээ: $0 push <STAMP> | prune | list [daily|weekly] | fetch <daily|weekly>/<файл> [dir] | check" >&2; exit 2 ;;
esac
