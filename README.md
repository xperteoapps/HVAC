# Sklep HVAC (B2C + B2B)

Dedykowany sklep internetowy dla branży HVAC (klimatyzacja, pompy ciepła, wentylacja, czynniki, akcesoria) zintegrowany z hurtowniami. Pełna specyfikacja i zasady pracy: **[CLAUDE.md](./CLAUDE.md)**. Architektura: [docs/architecture.md](./docs/architecture.md). Decyzje: [docs/decisions.md](./docs/decisions.md).

## Stack

- **Front:** React 18 + Vite + TypeScript (strict) + Tailwind + shadcn/ui + React Router + TanStack Query + zustand + react-hook-form/zod
- **Backend:** Supabase — Postgres (RLS), Auth, Edge Functions (Deno), pg_cron
- **Integracje:** `sync-supplier` (adaptery hurtowni), `calc-shipping`, `create-order`, `send-email` (Resend), `payment-webhook` (placeholder 501)

## Szybki start

```bash
cp .env.example .env            # uzupełnij VITE_SUPABASE_URL i VITE_SUPABASE_PUBLISHABLE_KEY
npm i
npm run dev                     # http://localhost:8080
npm run lint && npm run typecheck && npm run test
```

### Baza danych (projekt Supabase)

```bash
npx supabase link --project-ref <ref>
npx supabase db push                                   # migracje z supabase/migrations
psql "$SUPABASE_DB_URL" -f supabase/seed.sql           # kategorie, atrybuty, dostawa, 39 produktów demo
npx supabase functions deploy sync-supplier calc-shipping create-order send-email payment-webhook
npm run db:types                                       # regeneracja src/integrations/supabase/types.ts
```

Sekrety Edge Functions (Dashboard → Edge Functions → Secrets): `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `SHOP_NAME`, `SHOP_URL`, `BANK_ACCOUNT_NUMBER`, `SUPPLIER_<CODE>_URL/_LOGIN/_PASSWORD/_FORMAT`.

Pierwszy admin: po rejestracji ustaw w SQL `update profiles set role = 'admin' where email = '...'`.

Synchronizacja hurtowni demo: panel admina → Hurtownie → „Synchronizuj teraz” przy `mock` (lub `curl` — patrz `supabase/functions/sync-supplier/README.md`).

### Lokalny Postgres bez Dockera (opcjonalnie)

```bash
scripts/db-local-reset.sh       # migracje + seed na lokalnym PG 16 (shim auth w scripts/db-local-shim.sql)
scripts/gen-types-local.sh      # typy TS z lokalnej bazy
```

## Struktura

Zgodna z sekcją 3 CLAUDE.md: `src/pages`, `src/components/{layout,catalog,product,cart,checkout,account,admin,ui}`, `src/hooks`, `src/lib`, `supabase/{migrations,seed.sql,functions}`, `docs/`, `tests/`.

## Trasy

| Ścieżka | Widok |
|---|---|
| `/` | Strona główna |
| `/kategoria/:slug` | Listing z filtrami (stan w URL) |
| `/produkt/:slug` | Karta produktu |
| `/szukaj?q=` | Wyszukiwarka full-text |
| `/koszyk`, `/zamowienie`, `/zamowienie/potwierdzenie/:number` | Koszyk, checkout, potwierdzenie |
| `/logowanie`, `/rejestracja`, `/konto/*` | Auth i konto klienta |
| `/b2b`, `/strona/:slug` | Strefa B2B, strony statyczne |
| `/admin/*` | Panel admina (role `admin`/`staff`) |

## Otwarte kwestie (TODO(ustalić))

Branding klienta, dostawca płatności online, formaty feedów 5 hurtowni i dane dostępowe, dane sprzedawcy (regulamin, stopka), numer konta, domena nadawcy e-mail. Lista w `docs/decisions.md`.
