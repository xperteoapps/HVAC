# sync-supplier

Orchestrator synchronizacji hurtowni: pobiera feed przez adapter, waliduje (zod), upsertuje
`supplier_offers`, dezaktywuje oferty nieobecne w feedzie, auto-mapuje do `products`
(mapowania ręczne → EAN → SKU → auto-create gdy `feed_config.auto_create_products`), przelicza
produkty (`recalc_products`) i zapisuje `sync_runs` oraz `suppliers.last_sync_*`.

## Uruchomienie lokalne

```bash
npx supabase start
npx supabase functions serve --no-verify-jwt --env-file supabase/.env.local

# synchronizacja hurtowni demo (klucz service role z `npx supabase status`)
curl -s -X POST http://127.0.0.1:54321/functions/v1/sync-supplier \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"supplierCode":"mock","source":"manual"}'
```

Odpowiedzi:

- `200 { status: "ok", run: { id, items_total, items_new, items_updated, items_unmapped, errors_count, ... } }`
- `200 { status: "not_configured", message }` — adapter rzucił `NotConfiguredError` (brak URL/dostępów)
- `200 { skipped: true }` — hurtownia nieaktywna, a wywołanie przyszło z `source: "cron"`
- `500 { error: { message, code: "SYNC_FAILED" } }` — błąd krytyczny; `sync_runs.status = 'failed'`, e-mail do `ADMIN_EMAIL`

Autoryzacja: `Authorization: Bearer <service_role_key>` (pg_cron, skrypty) **albo** JWT użytkownika
z rolą `admin` / `staff` w `profiles` (przycisk „Synchronizuj teraz” w panelu).

## Zmienne środowiskowe (Supabase → Edge Function secrets)

| Zmienna | Opis |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ustawiane automatycznie przez platformę |
| `SUPPLIER_<CODE>_URL` | URL feedu (`CODE` = `IGLOCAR` / `AUTOKLIMA` / `KAISAI` / `TERMOSILESIA` / `SINCLAIR`) |
| `SUPPLIER_<CODE>_LOGIN`, `SUPPLIER_<CODE>_PASSWORD` | basic auth do feedu (opcjonalnie) |
| `SUPPLIER_<CODE>_FORMAT` | `csv` / `xml` / `json`; brak = detekcja po Content-Type / rozszerzeniu |
| `ADMIN_EMAIL` | adresat alertu o nieudanym syncu |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SHOP_NAME`, `SHOP_URL` | e-maile (brak klucza = wysyłka pomijana, bez błędu) |

Te same klucze (`url`, `login`, `password`, `format`) można trzymać w `suppliers.feed_config`
(mają pierwszeństwo przed env). `feed_config.auto_create_products: true` włącza tworzenie
produktów `status='hidden'` dla ofert bez dopasowania.

## Dodanie nowego adaptera

1. Uzupełnij `docs/suppliers/<code>.md` (format, auth, URL, przykładowy rekord, częstotliwość).
2. Utwórz `adapters/<code>.ts`:
   - feed HTTP (CSV/XML/JSON): `createFeedAdapter({ code, supplierName, fieldMap, xmlItemTag })`
     z `./feed-adapter.ts` i własną mapą pól;
   - inny transport (FTP, API z paginacją): zaimplementuj `SupplierAdapter` z `./adapters/types.ts`
     ręcznie — `fetch(config)` zwraca `SupplierOfferRaw[]`, przy braku dostępów rzuca `NotConfiguredError`.
3. Zarejestruj adapter w `ADAPTERS` w `index.ts` (klucz = `suppliers.code`).
4. Dodaj wiersz do `suppliers` (seed/migracja) i harmonogram w `supabase/migrations/*_cron.sql`.
5. Mapowanie kategorii i atrybutów: `normalize.ts` (`CATEGORY_MAP`, `ATTRIBUTE_ALIASES`) —
   testowalne vitestem (plik jest czystym TS bez importów Deno).

## Limity

Feed jest ładowany w całości do pamięci; zapisy idą paczkami (500 upsert / 200 lookup / 200 recalc).
Dla feedów > 50k pozycji potrzebny parser strumieniowy — patrz TODO w `index.ts` i `adapters/feed-adapter.ts`.
