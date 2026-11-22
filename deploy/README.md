# CLÉSS — Production байршуулалт (Ubuntu 24.04 VPS)

Нэг серверт бүх зүйл Docker-оор ажиллана:

| Service | Үүрэг |
| --- | --- |
| `caddy` | 80/443 — автомат HTTPS (Let's Encrypt), www → apex, gzip/zstd, security header, `/uploads/*` зураг |
| `app` | Next.js (standalone), `/api/health` healthcheck |
| `worker` | Outbox (имэйл, QPay invoice цуцлах), QPay шалгалт, түгжээ тайлах |
| `db` | Postgres 16 (`localdb` profile; порт гадагш нээгдэхгүй) |
| `backup` | Өдөр бүр 03:00 DB + зургийн backup → `./backups`, 14 хоног, S3 (сонголттой) |
| `tools` | Зөвхөн команд: `migrate deploy`, админ үүсгэх |

Өгөгдөл хадгалагдах газар (container устгаж дахин үүсгэхэд **устахгүй**): `pgdata` (DB), `uploads` (админаас оруулсан зураг), `caddy_data` (SSL гэрчилгээ), `./backups/`.

> Доорх командуудад `dc` гэдэг нь
> `docker compose --env-file .env.production -f docker-compose.prod.yml` (§4-т alias үүсгэнэ).

---

## 1. Сервер бэлдэх

VPS худалдаж авна: **Ubuntu 24.04, 2 vCPU, 4GB RAM, 40GB+ SSD** (build-д 2GB+ RAM хэрэгтэй).

### 1.1 SSH түлхүүр (өөрийн компьютер дээр)

```bash
ssh-keygen -t ed25519 -C "cless-deploy"      # байхгүй бол
ssh-copy-id root@<SERVER_IP>
ssh root@<SERVER_IP>
```

### 1.2 Тусдаа хэрэглэгч, нууц үгээр нэвтрэхийг хаах

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# /etc/ssh/sshd_config.d/99-hardening.conf
cat >/etc/ssh/sshd_config.d/99-hardening.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin no
EOF
systemctl restart ssh
```

Шинэ терминалаас `ssh deploy@<SERVER_IP>` ажиллаж байгааг шалгасны **дараа** л хуучин session-оо хаана.

### 1.3 Firewall (ufw)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp     # HTTP/3
sudo ufw enable
sudo ufw status
```

> ⚠️ Docker-ийн `ports:` нь ufw-г тойрдог. Тиймээс compose-д зөвхөн `caddy` порт нээдэг; `db` порт **нээхгүй**.

### 1.4 Цагийн бүс, автомат шинэчлэл

```bash
sudo timedatectl set-timezone Asia/Ulaanbaatar
sudo apt update && sudo apt -y upgrade
sudo apt -y install unattended-upgrades git
```

## 2. Docker суулгах

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
exit   # дахин нэвтэрнэ (группын эрх идэвхжинэ)
docker compose version   # v2.24+ байх ёстой
```

## 3. Домэйн (DNS)

Домэйн бүртгэгчийн DNS тохиргоонд:

| Төрөл | Нэр | Утга |
| --- | --- | --- |
| A | `@` | `<SERVER_IP>` |
| A | `www` | `<SERVER_IP>` |

Шалгах: `dig +short cless.mn` → серверийн IP. DNS тархахаас **өмнө** Caddy-г асаавал гэрчилгээ авч чадахгүй (дараа нь `dc restart caddy`).

## 4. Код татах, тохиргоо

```bash
sudo mkdir -p /opt/cless && sudo chown deploy:deploy /opt/cless
git clone https://github.com/<org>/cless.git /opt/cless
cd /opt/cless

echo "alias dc='docker compose --env-file .env.production -f docker-compose.prod.yml'" >> ~/.bashrc
source ~/.bashrc

cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Заавал бөглөх: `SITE_DOMAIN`, `POSTGRES_PASSWORD`, `DATABASE_URL`/`DIRECT_URL` (нууц үгийг оруулна), `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`. Нууц утга үүсгэх:

```bash
openssl rand -hex 24      # POSTGRES_PASSWORD
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # QPAY_CALLBACK_SECRET
```

QPay, Resend-ийг дараа нь бөглөж болно (бөглөсний дараа `dc up -d app worker`).

## 5. Анхны асаалт

```bash
dc up -d db                                           # 1. DB
dc --profile tools build tools                        # 2. tools image (DB хэрэггүй)
dc --profile tools run --rm tools bun run db:deploy   # 3. migration (app build-ээс ӨМНӨ)
dc build app                                          # 4. app image (~3–5 мин, prerender-д DB хэрэгтэй)
dc up -d                                              # 5. app, worker, caddy, backup
dc ps                                # бүгд "running", app "healthy"
```

Шалгах:

```bash
curl -s https://cless.mn/api/health          # {"status":"ok","db":"ok",...}
curl -sI https://www.cless.mn | head -3      # 308 → https://cless.mn/
```

## 6. Анхны админ үүсгэх

Seed нь production-д **ажиллахгүй**. Оронд нь:

```bash
dc --profile tools run --rm tools bun scripts/create-admin.ts --email admin@cless.mn --name "Админ"
# Нууц үгийг асууна (8+ тэмдэгт, дэлгэцэнд харагдахгүй)
```

Дараа нь `https://cless.mn/admin`-аар нэвтэрч, бусад ажилтныг **Хэрэглэгчид** хэсгээс нэмнэ. Нууц үгээ мартсан бол ижил командад `--reset` нэмнэ.

## 7. Шинэчлэл хийх

```bash
cd /opt/cless
./deploy/update.sh
```

Скрипт: `git pull` → **backup** → build → `migrate deploy` → restart → health шалгана. Build, migration эсвэл health амжилтгүй бол өмнөх image руу автоматаар буцна.

> Migration DB-д ажилласны дараа app унавал image буцсан ч DB шинэ schema-тай үлдэнэ. Ихэнх migration (багана нэмэх) хуучин кодтой зэрэгцэн ажилладаг. Үгүй бол §10-аар шинэчлэлийн өмнөх backup-аас сэргээнэ.

Тодорхой хувилбар: `./deploy/update.sh <commit|tag>`. Үүний дараа branch руугаа буцах: `git checkout main`.

## 8. Лог харах

```bash
dc logs -f app            # Next.js
dc logs -f worker         # outbox, QPay
dc logs -f caddy          # HTTPS, хүсэлтүүд
dc logs --tail 100 backup
dc ps                     # төлөв, health
```

Лог хэт томрохоос сэргийлж `/etc/docker/daemon.json`:

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
```

`sudo systemctl restart docker` (бүх container дахин асна).

## 9. Backup

- Өдөр бүр **03:00** (`BACKUP_AT`) → `./backups/cless-YYYYMMDD-HHMMSS.dump` + `uploads-….tar.gz`
- **14 хоног** (`BACKUP_KEEP_DAYS`) хадгална
- `BACKUP_S3_*` бөглөвөл S3-compatible (Cloudflare R2, Backblaze B2, AWS S3) руу хуулна — **серверээс гадуур хуулбар заавал байлгахыг зөвлөж байна**

Гараар авах:

```bash
dc exec backup /scripts/backup.sh
ls -lh backups/
```

Өөрийн компьютер руу татах: `scp deploy@<SERVER_IP>:/opt/cless/backups/cless-*.dump .`

## 10. Backup-аас сэргээх

```bash
cd /opt/cless
ls backups/
./scripts/restore.sh backups/cless-20261127-030000.dump \
  --uploads backups/uploads-20261127-030000.tar.gz     # зураг (сонголттой)
# "yes" гэж баталгаажуулна
```

Скрипт:
1. `app`, `worker`-ийг зогсооно
2. Одоогийн DB-г `backups/pre-restore-*.dump` болгон хадгална (буцаах боломж)
3. DB-г бүрэн цэвэрлээд backup-аас сэргээнэ (алдаа гарвал 2-ыг автоматаар буцааж тавина)
4. Мөрийн тоог (Product, Variant, Sale, User) хэвлэнэ, `app`/`worker`-ийг асаана

Сэргээсний дараа хуучин backup-ийн schema одоогийн кодоос хоцорсон байж болно → `dc --profile tools run --rm tools bun run db:deploy`.

## 11. Гадны DB (Supabase г.м.) ашиглах

`.env.production`-д:

```
COMPOSE_PROFILES=
DATABASE_URL=<pooler, порт 6543, ?pgbouncer=true>
DIRECT_URL=<session/direct, порт 5432>
```

Build `DATABASE_URL`-ээр prerender хийнэ. `backup` нь `DIRECT_URL`-ээс dump авна. `restore.sh` нь `public` schema-г устгадаг тул Supabase-д **ашиглахгүй** — Supabase-ийн өөрийн сэргээлтийг ашиглана.

## 12. Түгээмэл асуудал

| Шинж | Шалтгаан / шийдэл |
| --- | --- |
| Caddy: `obtaining certificate … failed` | DNS сервер рүү заагаагүй, эсвэл 80/443 хаалттай. `dig`, `ufw status` → `dc restart caddy` |
| Build: `Can't reach database server` | `dc up -d db`-г эхэлж асаасан эсэх, `DATABASE_URL`-ийн host `db` эсэх |
| `/api/health` 503 | `dc logs db`, `dc ps` — DB ажиллаж байгаа эсэх |
| Зураг 404 | `dc exec app ls public/uploads` — volume холбогдсон эсэх |
| Имэйл явахгүй | `RESEND_API_KEY`, `EMAIL_FROM` → `dc up -d app worker`; `dc logs worker` |
| Нэвтрэх үед `UntrustedHost` | `AUTH_URL` = `https://<домэйн>` эсэх |
