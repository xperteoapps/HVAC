# ADR — rejestr decyzji architektonicznych

Format: Kontekst / Decyzja / Konsekwencje, ok. 5 linijek. Każda istotna decyzja = nowy wpis `ADR-NNN`. Nie edytuj starych wpisów — dodaj nowy, który je uchyla.

## ADR-001 — Ceny w groszach jako `integer`
**Kontekst:** Ceny z feedów, marże i VAT; `float` daje błędy zaokrągleń, a `numeric` komplikuje typy po stronie TS.
**Decyzja:** Wszystkie kwoty w DB i w Edge Functions to grosze w `integer` (`*_cents`). Zaokrąglanie do pełnego grosza (`round()`), bez końcówek `.99`. Prezentacja `x,xx zł` (`formatters.ts`), bez liczenia VAT na froncie.
**Konsekwencje:** Proste sumowanie bez błędów; wymaga dyscypliny w nazewnictwie (`_cents`) i konwersji tylko w warstwie prezentacji.

## ADR-002 — Jeden katalog + `supplier_offers` + `recalc_product` w SQL
**Kontekst:** 5 hurtowni oferuje te same produkty w różnych cenach i stanach; sklep ma pokazywać jeden produkt z jedną ceną.
**Decyzja:** Tabela `products` jest katalogiem, `supplier_offers` ofertami per hurtownia; pola pochodne (`best_supplier_id`, `price_net/gross_cents`, `stock_total`, `stock_status`, `lead_time_days`) wylicza funkcja SQL `recalc_product` (SECURITY DEFINER) według reguł z `docs/architecture.md`. Triggery przeliczają produkt po ręcznym mapowaniu oferty (`supplier_offers_recalc_on_change`) i po zmianie `price_override_net_cents` / `vat_rate` (`products_recalc_on_change`); sync woła `recalc_products(uuid[])` batchem.
**Konsekwencje:** Jedna implementacja logiki cen (nie duplikowana w TS); zmiany reguł marż wymagają `recalc_all_products()`; `purchase_net_cents` jest w publicznie czytanej tabeli — front klienta nie może go pokazywać (rozważyć widok w fazie 2).

## ADR-003 — Koszyk gościa w localStorage, zalogowanego w DB
**Kontekst:** Gość nie ma `auth.uid()`, a dawanie roli `anon` zapisu do `carts` po `session_id` otwiera tabelę na śmieci.
**Decyzja:** Koszyk gościa trzymany wyłącznie w `zustand persist` (localStorage), bez wierszy w DB. Dla zalogowanego koszyk synchronizowany do `carts/cart_items` (RLS: właściciel). Przy logowaniu koszyk lokalny scalany z koszykiem w DB (suma ilości per produkt).
**Konsekwencje:** Brak polityk RLS dla `anon` na koszykach; gość traci koszyk przy zmianie urządzenia; `carts.session_id` zarezerwowane na przyszłość, `cleanup_expired_carts` dotyczy tylko koszyków bez profilu.

## ADR-004 — Zamówienia tylko przez Edge Function `create-order`
**Kontekst:** Klient nie może sam ustalać kwot zamówienia; RLS nie zweryfikuje poprawności sum.
**Decyzja:** Brak polityki INSERT na `orders`/`order_items` dla klientów. Zamówienie tworzy wyłącznie `create-order` (service_role), która przelicza ceny z DB, rabat grupy, VAT i dostawę (`_shared/shipping.ts`). Potwierdzenie dla gościa pochodzi z odpowiedzi funkcji (sessionStorage), nie z DB; zalogowany czyta `orders` przez RLS.
**Konsekwencje:** Jedno miejsce prawdy dla kwot; gość nie ma historii zamówień (tylko e-mail); funkcja musi być idempotentna na retry (TODO: klucz idempotencji w fazie 2).

## ADR-005 — Płatności: tylko provider `manual`
**Kontekst:** Klient nie wybrał bramki (P24 / PayU / Tpay / Stripe).
**Decyzja:** Interfejs `PaymentProvider` (`src/lib/payments/types.ts`) + implementacja `manual` (przelew tradycyjny: status `awaiting_payment`, e-mail z numerem konta `BANK_ACCOUNT_NUMBER`, tytuł = numer zamówienia, admin oznacza `paid`). `payment-webhook` istnieje i zwraca `501 Not Implemented`. `PAYMENT_PROVIDER=manual` w sekretach.
**Konsekwencje:** Zero integracji do utrzymania na start; dodanie bramki = nowa klasa providera + implementacja webhooka, bez zmian w checkout.

## ADR-006 — B2B jako flagi na profilu, bez logiki kredytowej
**Kontekst:** Instalatorzy potrzebują cen netto, rabatów i płatności odroczonej; pełny kredyt kupiecki jest poza MVP.
**Decyzja:** Klient podaje NIP/firmę → trigger ustawia `b2b_requested`. Admin ustawia `b2b_approved`, `customer_group_id` (rabat `discount_pct`, `price_mode='net'`) i opcjonalnie `deferred_payment_allowed`. Płatność odroczona = provider `manual`, `payment_status='deferred'`, `payment_due_date = +14 dni`, status `processing` od razu. Pola chroni trigger `profiles_protect_fields`.
**Konsekwencje:** Brak limitów kredytowych, windykacji, scoringu; termin 14 dni zaszyty w `create-order` (do konfiguracji w fazie 2).

## ADR-007 — Wyszukiwarka w Postgresie
**Kontekst:** Katalog kilku tysięcy pozycji; zewnętrzny silnik (Meilisearch/Algolia) to dodatkowy koszt i sync.
**Decyzja:** `products.search_vector` (tsvector, konfiguracja `simple` + `unaccent`, wagi: nazwa/SKU/EAN A, marka B, opis C) + `pg_trgm` na nazwie i SKU; RPC `search_products(query, limit, offset)` łączy ranking ts_rank i similarity, dokładne trafienie EAN.
**Konsekwencje:** Zero infrastruktury; brak stemmingu polskiego (konfiguracja `simple`) — podpowiedzi opierają się na trigramach; przy > 50k produktów zrewidować.

## ADR-008 — `types.ts` generowany z lokalnego Postgresa
**Kontekst:** W środowisku developerskim nie ma Dockera, więc `supabase start` / `db reset` nie działają; projekt zdalny jeszcze nie istnieje.
**Decyzja:** `scripts/db-local-reset.sh` odtwarza schemat na lokalnym Postgresie 16 z shimem `auth`/`vault` (`scripts/db-local-shim.sql`), a `scripts/gen-types-local.sh` generuje `src/integrations/supabase/types.ts` przez `supabase gen types --db-url`. Docelowo `npm run db:types` z projektu zdalnego.
**Konsekwencje:** Typy mogą minimalnie różnić się od projektu zdalnego (brak schematów Supabase); shim nigdy nie trafia na produkcję; `types.ts` pozostaje plikiem generowanym, nie edytowanym ręcznie.

## ADR-009 — Numeracja zamówień `ZAM/<rok>/<000001>`
**Kontekst:** Numer zamówienia musi być czytelny, roczny i bez luk w ramach roku; sekwencje Postgresa dają luki po rollbacku.
**Decyzja:** Tabela `order_counters(year, last_number)` + funkcja `next_order_number()` (SECURITY DEFINER, `insert ... on conflict do update ... returning`) wołana triggerem `orders_set_number` BEFORE INSERT. Brak polityk RLS na `order_counters`; `execute` odebrane klientom.
**Konsekwencje:** Blokada wiersza licznika serializuje inserty w roku (akceptowalne przy wolumenie sklepu); numer przydzielany w tej samej transakcji co zamówienie — rollback nie zostawia luki; luki możliwe tylko przy ręcznej ingerencji.

## ADR-010 — Mock jako pierwsze źródło danych
**Kontekst:** Brak dostępów do feedów 5 hurtowni; sklep ma działać end-to-end przed integracjami.
**Decyzja:** Adapter `mock` (~70 pozycji spójnych z `seed.sql`, 39 mapowanych po EAN, reszta do auto-create/kolejki) jest aktywny lokalnie; prawdziwe adaptery (`iglocar`, `autoklima`, `kaisai`, `termosilesia`, `sinclair`) rzucają `NotConfiguredError` do czasu ustawienia `SUPPLIER_<CODE>_*`, a admin pokazuje "oczekuje na dane dostępowe".
**Konsekwencje:** Cały front, checkout i admin testowalne od dnia 1; na produkcji `suppliers.active=false` dla `mock`; każda prawdziwa hurtownia wymaga najpierw wypełnienia `docs/suppliers/<code>.md`.

## ADR-011 — Harmonogram pg_cron przez `schedule_supplier_sync`
**Kontekst:** Sync co 60 min per hurtownia z przesunięciem; migracja musi działać też tam, gdzie nie ma `pg_cron`/`pg_net` (lokalny Postgres, świeży projekt).
**Decyzja:** Funkcja `schedule_supplier_sync(code, cron)` (SECURITY DEFINER) czyta `project_url` i `service_role_key` z Vault i rejestruje `cron.schedule` z `net.http_post` do `sync-supplier`. Brak rozszerzenia lub sekretu → `NOTICE` i no-op. Joby co godzinę z offsetem 0/10/20/30/40 min; `cleanup-expired-carts` o 3:15.
**Konsekwencje:** Migracja idempotentna i bezpieczna; wymaga jednorazowej konfiguracji Vault na projekcie i ponownego wywołania funkcji; klucz service_role nie trafia do kodu.

## ADR-012 — Brak SSR, SEO po stronie klienta
**Kontekst:** Lovable publikuje SPA (Vite); SSR/Next nie jest dostępny w tym workflow.
**Decyzja:** SEO przez `react-helmet-async` (title/meta/canonical per strona), JSON-LD `Product` / `BreadcrumbList`, czyste slugi, `sitemap.xml` generowany Edge Function (faza późniejsza). Prerendering/SSR — nie w MVP.
**Konsekwencje:** Google renderuje JS (akceptowalne), inne boty i podglądy social mogą nie widzieć treści; jeśli SEO okaże się krytyczne — rozważyć prerender w fazie 4.

## ADR-013 — Projekt zbudowany od zera w strukturze zgodnej z Lovable
**Kontekst:** Zakładany scaffold Lovable nie istniał w repo w momencie startu prac.
**Decyzja:** Repo zbudowane od zera w układzie, który Lovable rozpoznaje i może przejąć: Vite + React 18 + TypeScript + Tailwind 3 + shadcn/ui (`components.json`), `src/integrations/supabase/`, `supabase/` z migracjami i funkcjami, skrypty `dev/build/build:dev/preview/lint`.
**Konsekwencje:** Lovable może commitować UI na `main` bez konfliktów strukturalnych; obowiązuje `git pull` przed pracą; część konwencji Lovable (np. generowany `types.ts`) utrzymujemy ręcznie do czasu podpięcia projektu.

## ADR-014 — Bramka płatności online: imoje (ING)
**Kontekst:** CLAUDE.md zostawiał wybór bramki (P24 / PayU / Tpay / Stripe) do decyzji klienta; klient wskazał imoje.
**Decyzja:** Provider `imoje` przez link płatności REST (`POST /merchant/{merchantId}/payment`) tworzony w `create-order`; notyfikacje do `payment-webhook` z weryfikacją `hash(rawBody + serviceKey)`; ponowienie przez `create-payment`. Lista aktywnych dostawców sterowana sekretem `PAYMENT_PROVIDERS` i zwracana przez `calc-shipping`. Przy awarii API zamówienie zostaje z opcją przelewu (fallback `manual`).
**Konsekwencje:** `manual` i płatność odroczona bez zmian; zwroty z admina i widget kartowy poza MVP; szczegóły i konfiguracja w `docs/payments-imoje.md`.

## ADR-015 — Testy e2e na pełnym lokalnym Supabase
**Kontekst:** DoD wymaga działania end-to-end (katalog → checkout → zamówienie → admin), RLS i mobile 375 px; testy jednostkowe nie łapią błędów integracji formularzy, Edge Functions i bazy.
**Decyzja:** Playwright (`e2e/`) na `npx supabase start` + Vite dev; obrazy z Docker Hub (`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`), Edge Runtime odtwarzany z zaufanym CA za proxy TLS (`scripts/edge-runtime-with-ca.sh`), bramka imoje jako atrapa w sieci Dockera + podpisane notyfikacje z testu.
**Konsekwencje:** Testy wymagają Dockera (nie są częścią `npm run test`); pierwsze uruchomienie wykryło 2 realne błędy (blokada checkoutu przez walidację ukrytego adresu do faktury, poziomy scroll karty produktu na 375 px).

---

## Otwarte pytania (TODO(ustalić))

1. **Branding** — nazwa sklepu (`SHOP_NAME`), logo, paleta (obecnie neutralna: `#0F172A` / `#0EA5E9` / `#F8FAFC`), domena.
2. **imoje** — dane dostępowe (merchantId, serviceId, serviceKey, token API) do sandboxa i produkcji; decyzja o dostawcy podjęta (ADR-014).
3. **Formaty feedów 5 hurtowni** — Igłocar, Autoklima, KAISAI, Termosilesia, Sinclair: format, auth, dostępy testowe (pytania w `docs/suppliers/*.md`).
4. **Dane sprzedawcy** — pełna nazwa firmy, adres, NIP, KRS/CEIDG, kontakt do regulaminu, polityki prywatności i stopki.
5. **Numer konta bankowego** (`BANK_ACCOUNT_NUMBER`) do instrukcji przelewu.
6. **Adres e-mail nadawcy** (`EMAIL_FROM`) i domena zweryfikowana w Resend; adres `ADMIN_EMAIL`.
7. **Allegro / Ceneo** — integracja bezpośrednia vs BaseLinker.
8. **Fakturownia** — czy faktury automatyczne w fazie 3; token API.
9. Termin płatności odroczonej (obecnie 14 dni na sztywno) i progi darmowej dostawy B2C/B2B (seed: 1500 zł brutto / 2000 zł netto, paleta B2B od 5000 zł).
