#!/usr/bin/env bash
# Шинэчлэл: git pull → backup → build → migrate deploy → restart → health шалгах.
# Алдаа гарвал өмнөх image руу буцаана.
#
#   ./deploy/update.sh            # origin/<одоогийн branch>-ийн сүүлийн хувилбар
#   ./deploy/update.sh <git-ref>  # тодорхой commit/tag
set -euo pipefail
cd "$(dirname "$0")/.."

DC=(docker compose --env-file .env.production -f docker-compose.prod.yml)
log() { echo -e "\033[1m[update $(date '+%H:%M:%S')]\033[0m $*"; }
die() { echo -e "\033[31m✗ $*\033[0m" >&2; exit 1; }

[ -f .env.production ] || die ".env.production олдсонгүй"
[ -z "$(git status --porcelain --untracked-files=no)" ] || die "Сервер дээрх repo-д commit хийгдээгүй өөрчлөлт байна (git status)."

set_tag() { sed -i.bak -E "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" .env.production && rm -f .env.production.bak; grep -q '^IMAGE_TAG=' .env.production || echo "IMAGE_TAG=$1" >> .env.production; }

PREV_TAG=$(grep -E '^IMAGE_TAG=' .env.production | cut -d= -f2 || true)
PREV_TAG=${PREV_TAG:-latest}
PREV_REF=$(git rev-parse HEAD)

log "1/6 Код татаж байна"
git fetch --quiet origin
if [ $# -ge 1 ]; then git checkout --quiet "$1"; else git merge --ff-only --quiet "@{u}"; fi
NEW_TAG=$(git rev-parse --short HEAD)
log "    ${PREV_REF:0:7} → ${NEW_TAG}"

rollback() {
  log "↩ Буцааж байна: image ${PREV_TAG}, код ${PREV_REF:0:7}"
  git checkout --quiet "$PREV_REF" || true
  set_tag "$PREV_TAG"
  IMAGE_TAG="$PREV_TAG" "${DC[@]}" up -d --no-build app worker || true
  die "$1 — өмнөх хувилбарт буцлаа. Migration ажилласан бол backup-аас сэргээх шаардлагатай эсэхийг шалгана уу (deploy/README.md §10)."
}

log "2/6 DB асааж, backup авч байна"
"${DC[@]}" up -d db 2>/dev/null || true   # localdb profile байхгүй бол алгасна
"${DC[@]}" up -d backup
"${DC[@]}" exec -T backup /scripts/backup.sh || die "Backup амжилтгүй — шинэчлэлийг зогсоолоо"

log "3/6 Image build (${NEW_TAG})"
IMAGE_TAG="$NEW_TAG" "${DC[@]}" --profile tools build app tools || rollback "Build амжилтгүй"

log "4/6 prisma migrate deploy"
IMAGE_TAG="$NEW_TAG" "${DC[@]}" --profile tools run --rm tools bun run db:deploy || rollback "Migration амжилтгүй"

log "5/6 Restart"
set_tag "$NEW_TAG"
IMAGE_TAG="$NEW_TAG" "${DC[@]}" up -d --no-build app worker caddy backup || rollback "Container асаж чадсангүй"

log "6/6 Health шалгаж байна (≤120с)"
cid=$("${DC[@]}" ps -q app)
for _ in $(seq 1 40); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo unknown)
  [ "$status" = "healthy" ] && { log "✓ Амжилттай: ${NEW_TAG}"; docker image prune -f >/dev/null; exit 0; }
  [ "$status" = "unhealthy" ] && break
  sleep 3
done
"${DC[@]}" logs --tail 50 app
rollback "App healthy болсонгүй (${status})"
