# Biologique Recherche Mongolia

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
bun run dev                   # http://localhost:3000
```

Шалгах: `bun run typecheck`, `bun run lint`, `bun run build`.

> `bun run build` нь нүүр хуудсыг build үед prerender хийдэг тул DB-д холбогдох боломжтой байх ёстой.

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

## Seed хэрэглэгчид

| Имэйл | Эрх |
| --- | --- |
| admin@example.mn | ADMIN |
| manager@example.mn | MANAGER |
| staff1@example.mn, staff2@example.mn | STAFF |

Бүгдийн нууц үг: `SEED_ADMIN_PASSWORD` (зөвхөн dev-д). Seed-ийг дахин ажиллуулахад нууц үг өөрчлөгдөхгүй.
