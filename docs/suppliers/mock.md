# Hurtownia: mock (`mock`)

Adapter demonstracyjny — pierwsze i jedyne źródło danych do czasu otrzymania dostępów do prawdziwych hurtowni. Służy do developmentu frontu, checkoutu, panelu admina (kolejka mapowania, reguły marż) i testów e2e "sync → zmiana ceny".

| pole | wartość |
|---|---|
| Adapter | `supabase/functions/sync-supplier/adapters/mock.ts` |
| Dane | `supabase/functions/sync-supplier/adapters/mock-data.ts` (`MOCK_ITEMS`, ~70 pozycji, wygenerowane skryptem, spójne z `supabase/seed.sql`) |
| Format | w pamięci (brak pobierania; `feed_type = 'manual'`) |
| Auth / URL | brak |
| `feed_config` (seed) | `{"auto_create_products": true}` |
| `priority` (seed) | 900 (najniższy — przegrywa remis z każdą prawdziwą hurtownią) |
| `active` | **`true` tylko lokalnie / na stagingu; na produkcji `false`** |
| Harmonogram pg_cron | brak joba; sync tylko ręcznie z admina lub `POST /functions/v1/sync-supplier {"supplierCode":"mock"}` |

## Struktura danych

Każda pozycja `MockItem`:
```ts
{ sku, ean, name, brand, category: string[], purchaseNetCents, stock, leadTimeDays?, weightKg, attributes, imageSeed }
```
Adapter mapuje je na `SupplierOfferRaw` (`supplierSku = sku`, `categoryPath = category`, `images` generowane z `imageSeed`, `raw` = cały obiekt). SKU mają prefiks `MOCK-`, EAN-y zaczynają się od `5900000000…`.

## Zachowanie przy syncu

1. **Pierwsze 39 pozycji** odpowiadają 1:1 produktom z `seed.sql` (ten sam EAN, `supplier_sku = 'MOCK-' || products.sku`). Seed wstawia dla nich także gotowe `supplier_offers` i `product_mappings(matched_by='ean')`, więc ceny istnieją bez uruchamiania syncu. Sync nadpisuje te oferty (upsert po `supplier_id + supplier_sku`) — stany i ceny zakupu mogą się zmienić, co wymusza `recalc_product` (test "sync mock → zmiana ceny").
2. **Pozostałe ~30 pozycji** nie mają odpowiednika w seedzie:
   - przy `auto_create_products = true` (domyślnie w seedzie) orchestrator tworzy produkt ze `status='hidden'`, wpis `product_mappings(matched_by='auto_create')` i przelicza cenę — produkt jest widoczny tylko w adminie do czasu ręcznej publikacji (`status='active'`);
   - przy `auto_create_products = false` oferty zostają z `product_id = null` i trafiają do kolejki mapowania w adminie (dopasuj / utwórz / ignoruj).
3. Pozycje ze `stock = 0` i `leadTimeDays` ćwiczą status `on_order`; pozycje ze stanem 1–3 — status `low`.
4. Mock nie zgłasza błędów walidacji; do testu obsługi błędów zod dodać celowo uszkodzony rekord w teście jednostkowym, nie w `mock-data.ts`.

## Zmienne środowiskowe

Brak. Adapter nie czyta `SUPPLIER_MOCK_*`.

## Produkcja

Przed uruchomieniem produkcyjnym:
- `update public.suppliers set active = false where code = 'mock';`
- oferty mock zostają w `supplier_offers`, ale `recalc_product` ignoruje oferty nieaktywnych hurtowni (`join suppliers s on s.active`) — produkty bez innych ofert przejdą w `unavailable` / `price_net_cents = null`;
- produkty `hidden` utworzone z mocka usunąć lub zostawić ukryte.

`TODO(ustalić)`: czy na produkcji startujemy z pustym katalogiem, czy z produktami z seeda uzupełnionymi ręcznie o oferty pierwszej prawdziwej hurtowni.
