# Biologique Recherche Mongolia

[![CI](https://github.com/khulan77/cless/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/khulan77/cless/actions/workflows/ci.yml)

Biologique Recherche-ийн Монгол дахь албан ёсны дистрибьюторын систем: онлайн дэлгүүр, СПА салон (айлчлал/POS, цаг захиалга), агуулах, тайлан, цалин, eBarimt.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript strict · Tailwind CSS 4 · PostgreSQL + Prisma 7 · Bun

## Setup

```bash
# 1. Dependency суулгах (`prisma generate` автоматаар ажиллана)
bun install

# 2. Орчны хувьсагч
cp .env.example .env
#    DATABASE_URL, DIRECT_URL, SEED_ADMIN_PASSWORD-ийг бөглөнө

# 3. Postgres бэлдэх: доорх хоёрын аль нэг
docker compose up -d          # локал Postgres 16
#   .env: DATABASE_URL=DIRECT_URL="postgresql://postgres:postgres@localhost:5432/biologique"
#   эсвэл Supabase: DATABASE_URL = Transaction pooler (6543), DIRECT_URL = Session pooler (5432)

# 4. Migration (btree_gist extension + цагийн давхцлын EXCLUDE constraint орно)
bun run db:migrate            # dev орчинд
bun run db:deploy             # production / Supabase дээр

# 5. Seed (idempotent — дахин ажиллуулж болно)
bun run db:seed

# 6. Ажиллуулах
bun run dev                   # http://127.0.0.1:20267
```

Шалгах: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`.

### Worker (имэйл, QPay шалгалт, ноорог цэвэрлэх)

POS-ийн айлчлалын имэйл, QPay төлбөрийн шалгалт, удаан түгжигдсэн борлуулалт тайлах, 24 цагаас хуучирсан ноорог устгах ажлыг тусдаа **worker** процесс гүйцэтгэнэ. Worker ажиллахгүй бол имэйл "Дараалалд" төлөвт гацна; хянах самбарт "Worker сүүлд ажилласан: N минутын өмнө" (5 минутаас удаан бол улаан) харагдана.

```bash
bun run dev:all     # Next dev + worker зэрэг (dev-д үүнийг ашиглана)
bun run worker      # зөвхөн worker
```

- `WESEND_API_KEY` байхгүй үед SMS, имэйл, код илгээгдэхгүй — `.emails/` хавтсанд файл болно (SMS: `sms-*.txt`, код: `verify-*.txt`). `RESEND_API_KEY`, `EMAIL_FROM` (хуучирсан) байхгүй үед ч мөн адил — `.emails/<job-id>.html` файл болж үүснэ (gitignore), `Visit.emailStatus` = SENT.
- Production deploy: [deploy/README.md](deploy/README.md)

### E2E (Playwright)

Өөрийн локал DB-д (`cless_e2e`, ажиллах бүрт цэвэрлэнэ — Supabase-д хэзээ ч хүрэхгүй) production build + worker-ийг асааж POS-ийн бүтэн урсгалыг шалгана.

```bash
bunx playwright install chromium   # нэг удаа (эсвэл E2E_CHROMIUM_PATH=<chromium>)
bun run build && bun run test:e2e
```

### Нээлтийн өмнө: туршилтын гүйлгээ цэвэрлэх

```bash
bun scripts/reset-transactions.ts            # юу устахыг харуулна (dry run)
bun scripts/reset-transactions.ts --confirm  # устгана (NODE_ENV=production үед ажиллахгүй)
```

Борлуулалт, төлбөр, айлчлал, кассын ээлж, туршилтын үйлчлүүлэгч (цаг захиалга/хэтэвчгүй), борлуулалттай холбоотой StockMovement-ийг устгаж `Variant.stock`-ийг дахин тооцно. Каталог, орлого/тооллого, хэрэглэгч, тохиргоо, AuditLog үлдэнэ. `--keep-customers` — үйлчлүүлэгчдийг үлдээнэ.

Админ: http://127.0.0.1:20267/admin (seed хэрэглэгчээр нэвтэрнэ).

> `bun run build` нь нүүр хуудсыг build үед prerender хийдэг тул DB-д холбогдох боломжтой байх ёстой.

## CI

**Дүрэм: PR-ийг merge хийхийн өмнө CI ногоон (✓ check, ✓ build) байх ёстой.**

`.github/workflows/ci.yml` — бүх pull request болон `main` руу push бүрт:

| Job | Юу хийнэ |
|---|---|
| `check` | `bun install --frozen-lockfile` → `prisma generate` → `next typegen` → `tsc --noEmit` → lint → vitest (unit + DB тест, CI доторх Postgres 16) |
| `build` | CI Postgres-д migrate + seed → `bun run build` (`ENV_CHECK=relaxed`, `NEXT_IMAGE_UNOPTIMIZED=1`) |
| `e2e` | Playwright — зөвхөн гараар: Actions → CI → **Run workflow** |

DB нь CI доторх түр Postgres (localhost) — Supabase болон ямар ч secret ашиглахгүй. Цагийн бүс `Asia/Ulaanbaatar`.

GitHub-д заавал болгох: Settings → Branches → `main` → *Require status checks to pass* → `check`, `build`.

## Vercel deploy (Supabase)

Vercel дээр зөвхөн вэб апп ажиллана. Worker (имэйл, QPay шалгалт) болон backup нь тусдаа сервер дээр (Docker, `deploy/`).

**Environment Variables** (Vercel → Settings → Environment Variables, Production ба Preview хоёуланд).
Утгыг хашилтгүй, `NAME=` угтваргүй, зай/шинэ мөргүй оруулна — `bun run build`-ийн өмнө `scripts/check-db-url.ts`
шалгаад, буруу бол утгыг нь хэвлэхгүйгээр юу нь буруу байгааг хэлнэ.

| Нэр | Заавал | Тайлбар |
|---|---|---|
| `DATABASE_URL` | ✓ | Supabase **Transaction pooler**: `postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | ✓ | Supabase **Session pooler** (порт 5432) эсвэл Direct — зөвхөн `prisma migrate`-д |
| `AUTH_SECRET` | ✓ | `openssl rand -base64 32` — локалынхаас өөр |
| `NEXT_PUBLIC_SITE_URL` | ✓ | `https://<domain>` (төгсгөлийн `/`-гүй) |
| `INTERNAL_REVALIDATE_SECRET` | ✓ | 32+ тэмдэгт; worker-тэй ИЖИЛ утга |
| `WESEND_API_KEY` | ✓ | WeSend: SMS, имэйл, нэг удаагийн код (production-д заавал) |
| `WESEND_WEBHOOK_SECRET` |  | WeSend webhook-ийн гарын үсэг (`/api/wesend/webhook`) |
| `NOTIFY_BRAND` |  | Брэнд: имэйлийн илгээгчийн нэр (анхдагч `CLÉSS`); SMS/кодонд автоматаар ASCII (`CLESS`, ≤20 тэмдэгт) — WeSend verify ASCII биш брэндийг `invalid_request`-ээр буцаадаг |
| `RESEND_API_KEY`, `EMAIL_FROM` |  | **Хуучирсан** — WeSend тохируулаагүй үед л имэйлд |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ✓ (Vercel) | Админаас оруулах зураг (бүтээгдэхүүн, үйлчилгээ, ангилал, контент) — Supabase Storage. Vercel-ийн диск read-only тул заавал; service role key зөвхөн сервер талд |
| `SUPABASE_PRIVATE_BUCKET` | | Анхдагч `visit-photos`. Айлчлалын өмнө/дараах зураг (`visits/…`), зардлын баримт (`receipts/…`). Supabase → Storage → New bucket **`visit-photos`, Public: OFF**. Нэмэлт env хэрэггүй (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`-ийг ашиглана). Файл зөвхөн эрх шалгадаг route-оор (сервер татаж) харагдана — public / signed URL үүсгэхгүй |
| `SUPABASE_STORAGE_BUCKET` | | Анхдагч `media`. Supabase → Storage дээр **Public** bucket үүсгэнэ. Зураг 4MB хүртэл (Vercel-ийн 4.5MB хүсэлтийн хязгаар) |
| `CRON_SECRET` | ✓ (Vercel) | Vercel Cron-ийн нууц (`openssl rand -hex 32`, 16+ тэмдэгт). `vercel.json`-ий cron өдөр бүр 23:50 (УБ, `50 15 * * *` UTC) `/api/cron/attendance`-ийг `Authorization: Bearer <CRON_SECRET>`-ээр дуудна: «Явлаа» дараагүй ирцийг хаах, 90 хоногоос хуучин байршил устгах. Vercel → Settings → Environment Variables (Production) — нэмээгүй бол cron 401 буцаана |
| `DB_POOL_MAX` | | Нэг instance-ийн pg холболт. Default 3 (Vercel) |
| `NEXT_IMAGE_UNOPTIMIZED` | | `1` — `/_next/image`-ийг алгасаж зургийг шууд өгнө (Hobby-ийн Image Optimization хязгаар дуусаж 402 өгвөл). Default зургууд, upload-ууд sharp-аар webp болсон тул чанар алдагдахгүй; зөвхөн дэлгэцийн өргөнөөр жижигрүүлсэн хувилбар (srcset) байхгүй болно. Build үед уншигдана — өөрчилбөл redeploy |
| `QPAY_*` | | Зөвхөн CHECKOUT горимд |

**Build ба DB.** Build нь нүүр хуудас, layout-ийн кэштэй өгөгдлийг prerender хийхдээ DB уншина (Supabase-д хүрэх
ёстой). `/products/[slug]`, `/collections/[slug]`, `/services/[slug]`-ийн жагсаалт DB-ээс уншигдахгүй бол build
унахгүй — анхааруулга бичээд, тэдгээр хуудас анх зочлоход render хийгдэж кэшлэгдэнэ (`src/server/static-params.ts`).

**Migration** (Vercel build migration хийхгүй — deploy-оос өмнө гараар):
```bash
set -a; . ./.env.demo; set +a      # DIRECT_URL = Session pooler 5432
bunx prisma migrate status
bunx prisma migrate deploy
```
Seed нь бодит өгөгдөлтэй DB дээр (төлөгдсөн борлуулалт эсвэл `system.launchedAt`) өөрөө зогсоно.

## Бүтэц

```
prisma/
  schema.prisma             бүх модулийн schema
  migrations/               init migration (+ гараар нэмсэн EXCLUDE/CHECK constraint)
  seed.ts                   placeholder өгөгдөл (Монгол)
src/
  app/(shop)/               public сайт (layout: announcement + header + footer)
  components/
    layout/                 AnnouncementBar, Header, MobileMenu, MegaMenu, Footer
    home/                   нүүр хуудасны section-ууд
    product/                ProductCard, VariantPicker
    ui/                     Button, Container, SectionTitle, Img
  server/
    db.ts                   Prisma singleton (server-only)
    queries/                кэштэй өгөгдлийн функцууд
  lib/
    money.ts                formatMNT(450000) → "450,000₮"
    site-settings.ts        SiteSetting-ийн key ба төрлүүд
public/placeholders/        түр SVG зургууд
```

## Зарчмууд

- **Мөнгө** бүгд `Int` (төгрөг).
- **SaleItem** нь нэр, үнэ, өртгийг snapshot хэлбэрээр хадгална.
- **Үлдэгдэл** = `StockMovement`-уудын нийлбэр. `Variant.stock` бол кэш бөгөөд зөвхөн movement-тэй нэг transaction дотор өөрчлөгдөнө. `Wallet.balance` / `WalletTxn` ч мөн адил.
- **Цаг захиалга:** нэг ажилтанд идэвхтэй (CANCELLED/NO_SHOW биш) цаг давхцахыг DB-ийн `EXCLUDE USING gist` constraint хориглоно.
- **Урамшуулал:** `CommissionRule.value` нь PERCENT үед basis point (1000 = 10%), FIXED үед төгрөг.
- **Контент:** нүүр хуудасны бүх текст `SiteSetting`-ээс уншигдана (`src/lib/site-settings.ts`-ийн төрлүүд). Setting байхгүй бол тухайн section харагдахгүй.
- **Кэш:** Cache Components горимд `export const revalidate`-ийг ашиглах боломжгүй. Оронд нь query бүр `"use cache"` + `cacheLife({ revalidate: 60 })`-тэй, `cacheTag("catalog" | "settings")`-аар админаас шууд шинэчилж болно.
- **Font:** Inter Tight (`--font-brand`). Лицензтэй font ирэхэд `src/app/layout.tsx`-д `next/font/local`-аар солино.

## Админ хэсэг

- **Нэвтрэлт:** Auth.js v5 (Credentials, JWT). `src/proxy.ts` (Next 16-д `middleware.ts` → `proxy.ts`) нь `/admin/*`-д session шаарддаг. Эрх ба `isActive` нь хүсэлт бүрт DB-ээс шалгагдана — идэвхгүй болгох / эрх бууруулах нь даруй хүчинтэй.
- **Rate limit:** IP болон имэйлээр 15 минутад 5 амжилтгүй оролдлого (`LoginAttempt` хүснэгт). Админ нууц үг шинэчлэхэд тухайн имэйлийн түгжээ арилна.
- **Эрх:** `src/server/auth/permissions.ts` — цорын ганц матриц. Server Action бүр `requirePermission()`-аар эхэлнэ (эрхгүй бол 403 үр дүн), хуудас бүр `requirePagePermission()` (эрхгүй бол `forbidden()`). Тест: `bun run test`.
- **Үлдэгдэл:** `Variant.stock` зөвхөн `src/server/actions/stock.ts`-д, мөрийг `FOR UPDATE`-ээр түгжиж `StockMovement`-тэй нэг transaction-д өөрчлөгдөнө. MANAGER уншина, ADMIN (`stock:write`) засна.
- **Зураг:** `src/server/storage/` — одоо `public/uploads` (gitignore). S3 руу шилжихэд `storage/index.ts`-ийн `storage`-ийг солино. ⚠️ `next start` нь build-ийн дараа `public/`-д нэмэгдсэн файлыг үйлчлэхгүй байж болзошгүй тул production-д S3/Cloudinary шаардлагатай.
- **Audit:** бичих үйлдэл бүр `AuditLog`-д (хэн, юу, өмнө/дараа). Нууц үг хэзээ ч лог-д орохгүй.
- **Архив:** бүтээгдэхүүн (`isPublished=false`), үйлчилгээ/хувилбар/хэрэглэгч (`isActive=false`). Ашиглагдаагүй ангиллыг л устгаж болно.

## Seed хэрэглэгчид

| Имэйл | Эрх |
| --- | --- |
| admin@example.mn | ADMIN |
| manager@example.mn | MANAGER |
| staff1@example.mn, staff2@example.mn | STAFF |

Бүгдийн нууц үг: `SEED_ADMIN_PASSWORD` (зөвхөн dev-д). Seed-ийг дахин ажиллуулахад нууц үг өөрчлөгдөхгүй.
