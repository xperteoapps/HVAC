# CLAUDE.md — Sklep HVAC (B2C + B2B)

> Plik startowy dla Claude Code. Przeczytaj w całości przed pierwszą zmianą w repo.
> Projekt: dedykowany sklep internetowy dla branży HVAC (klimatyzacja, pompy ciepła, wentylacja, rekuperacja, akcesoria), inspirowany **shop.enedeal.com**, zintegrowany z 5 hurtowniami.
> Wykonawca: Xperteo. Workflow: **Lovable (UI/scaffold) + Claude Code (logika, integracje, DB, edge functions)** przez GitHub sync.

---

## 0. TL;DR

- **Stack:** Lovable (React + Vite + TypeScript + Tailwind + shadcn/ui) + Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron).
- **Model danych:** jeden katalog produktów, N źródeł (hurtownie) → `supplier_offers` → agregacja do `products` z wyliczoną ceną i stanem.
- **Hurtownie:** Igłocar, Autoklima, KAISAI, Termosilesia, Sinclair — każda jako **adapter** w `supabase/functions/sync-supplier/adapters/*.ts`. Format feedu (API / XML / CSV / FTP) ustalany per hurtownia (sekcja 6).
- **Płatności:** `PaymentProvider` abstrakcja + providery `manual` (przelew tradycyjny / proforma, odroczona B2B) i **`imoje`** (ING — BLIK, karty, pbl; decyzja klienta, ADR-014, `docs/payments-imoje.md`). P24 / PayU / Tpay / Stripe — nie implementuj.
- **Dwa tryby cen:** B2C (brutto, detaliczne) i B2B (netto, rabaty grupowe, płatność odroczona — flaga, bez logiki kredytowej na start).
- **Zasada nadrzędna:** sklep ma działać end-to-end (katalog → koszyk → checkout → zamówienie → panel admina) **zanim** zaczniemy dopieszczać integracje. Najpierw mock adapter, potem prawdziwe feedy.

---

## 1. Kontekst biznesowy

- Branża: HVAC. Klient końcowy: instalatorzy (B2B), firmy, klienci indywidualni (B2C).
- Inspiracja UX/UI i struktury: **shop.enedeal.com** (ten sam schemat: hero z kategoriami, listing z filtrami technicznymi w lewym panelu, karta produktu z tabelą parametrów, prosty checkout, panel admina). Nie kopiuj brandingu Enedeal — tylko układ i logikę.
- Sklep ma własny branding (do dostarczenia przez klienta; do tego czasu neutralna paleta: ciemny granat `#0F172A`, akcent `#0EA5E9`, tło `#F8FAFC`). Nigdzie nie wstawiaj nazw "Xperteo" ani "Enedeal" w UI klienta.
- Język UI: **polski**. Waluta: **PLN**. VAT 23% (stawka konfigurowalna per produkt, domyślnie 23).

---

## 2. Stack i zasady pracy

### 2.1 Technologie
| Warstwa | Technologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript, Tailwind, shadcn/ui, React Router, TanStack Query, react-hook-form + zod |
| Backend | Supabase: Postgres + RLS, Auth (email+hasło, magic link), Storage (zdjęcia produktów), Edge Functions (Deno), pg_cron + pg_net |
| Integracje | Edge Functions `sync-supplier`, `calc-shipping`, `create-order`, `create-payment`, `payment-webhook` (imoje), `sitemap` |
| E-mail transakcyjny | Resend (przez Edge Function; klucz w secrets) |
| Faktury | Fakturownia API (faza 3, opcjonalnie) |
| Hosting | Lovable publish + własna domena klienta |

### 2.2 Podział Lovable / Claude Code
- **Lovable:** scaffold stron, komponenty UI, layouty, responsywność, szybkie poprawki wizualne.
- **Claude Code:** schemat DB i migracje, RLS, Edge Functions, adaptery hurtowni, logika cen/stanów, checkout, testy, refaktory.
- Repo jest podpięte do Lovable przez GitHub. **Zawsze `git pull` przed pracą** — Lovable commituje na `main`.
- Migracje: wyłącznie przez pliki w `supabase/migrations/` (nie klikaj w dashboardzie). Każda migracja idempotentna gdzie to możliwe.

### 2.3 Konwencje kodu
- TypeScript strict. Brak `any` poza granicą parsowania feedów (tam `unknown` + zod).
- Nazewnictwo DB: `snake_case`, tabele w liczbie mnogiej. Kolumny `created_at`, `updated_at` wszędzie (trigger `set_updated_at`).
- Każda tabela ma RLS włączone. Domyślnie deny. Polityki opisane w `docs/rls.md`.
- Ceny przechowujemy w **groszach jako `integer`** (`price_net_cents`, `price_gross_cents`). Nigdy float.
- Komponenty: `src/components/<domena>/<Nazwa>.tsx`. Hooki danych: `src/hooks/use<Nazwa>.ts`. Typy DB generowane: `src/integrations/supabase/types.ts` (nie edytuj ręcznie).
- Commity: `feat(catalog): ...`, `fix(checkout): ...`, `chore(sync): ...`.
- Nie dodawaj zależności bez potrzeby. Nie używaj CSS-in-JS.

### 2.4 Komendy
```bash
npm i
npm run dev                     # frontend
npx supabase start              # lokalny stack (opcjonalnie)
npx supabase db push            # migracje na projekt zdalny
npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/integrations/supabase/types.ts
npx supabase functions serve    # edge functions lokalnie
npx supabase functions deploy sync-supplier
npm run test                    # vitest
npm run lint && npm run typecheck
```

### 2.5 Sekrety (Supabase → Edge Function secrets, NIGDY w repo)
```
RESEND_API_KEY
SUPPLIER_IGLOCAR_*      # login/hasło/URL feedu — ustalić
SUPPLIER_AUTOKLIMA_*
SUPPLIER_KAISAI_*
SUPPLIER_TERMOSILESIA_*
SUPPLIER_SINCLAIR_*
PAYMENT_PROVIDERS=manual,imoje
IMOJE_MERCHANT_ID / IMOJE_SERVICE_ID / IMOJE_SERVICE_KEY / IMOJE_API_KEY / IMOJE_ENV=sandbox|production
FAKTUROWNIA_API_TOKEN   # faza 3
```

---

## 3. Struktura repo

```
/
├── CLAUDE.md                     # ten plik
├── docs/
│   ├── architecture.md           # diagram przepływu danych
│   ├── rls.md                    # polityki RLS tabela po tabeli
│   ├── suppliers/
│   │   ├── iglocar.md            # format feedu, mapowanie pól, częstotliwość
│   │   ├── autoklima.md
│   │   ├── kaisai.md
│   │   ├── termosilesia.md
│   │   └── sinclair.md
│   └── decisions.md              # ADR — każda istotna decyzja, 5 linijek
├── src/
│   ├── pages/                    # Home, Category, Product, Search, Cart, Checkout, OrderConfirm, Account/*, Admin/*
│   ├── components/
│   │   ├── layout/               # Header, MegaMenu, Footer, MobileNav
│   │   ├── catalog/              # ProductCard, ProductGrid, FilterSidebar, SortBar, Pagination
│   │   ├── product/              # Gallery, SpecTable, PriceBox, StockBadge, AddToCart, Documents
│   │   ├── cart/                 # CartDrawer, CartLine, CartSummary
│   │   ├── checkout/             # AddressForm, ShippingSelector, PaymentSelector, OrderReview
│   │   ├── account/              # Orders, Addresses, CompanyData
│   │   └── admin/                # ProductsTable, SupplierSync, OrdersBoard, MarginRules, Users
│   ├── hooks/
│   ├── lib/                      # pricing.ts, formatters.ts, seo.ts, cart-store.ts (zustand)
│   ├── integrations/supabase/
│   └── types/
├── supabase/
│   ├── migrations/
│   ├── seed.sql                  # kategorie HVAC + 30 produktów demo
│   └── functions/
│       ├── sync-supplier/
│       │   ├── index.ts          # orchestrator: pobierz → parsuj → upsert supplier_offers → recalc products
│       │   ├── adapters/
│       │   │   ├── types.ts      # interfejs SupplierAdapter
│       │   │   ├── mock.ts       # dane demo — do użycia zanim dostaniemy feedy
│       │   │   ├── iglocar.ts
│       │   │   ├── autoklima.ts
│       │   │   ├── kaisai.ts
│       │   │   ├── termosilesia.ts
│       │   │   └── sinclair.ts
│       │   └── normalize.ts      # mapowanie kategorii/parametrów na nasz słownik
│       ├── calc-shipping/
│       ├── create-order/
│       ├── create-payment/       # ponowny link płatności imoje
│       ├── payment-webhook/      # notyfikacje imoje (podpis, statusy)
│       └── send-email/
└── tests/
```

---

## 4. Model danych (Supabase)

### 4.1 Katalog
```sql
categories            (id, slug, name, parent_id, position, image_url, seo_title, seo_description)
brands                (id, slug, name, logo_url)
products              (id, sku, slug, name, brand_id, category_id, description_html,
                       attributes jsonb,           -- {moc_chlodnicza_kw: 3.5, klasa_energetyczna:"A++", czynnik:"R32", ...}
                       images text[], documents jsonb, -- [{name, url, type:"karta"|"instrukcja"|"deklaracja"}]
                       vat_rate numeric default 23,
                       weight_kg numeric, pallet_required bool default false,
                       status text check (status in ('active','hidden','discontinued')),
                       -- pola wyliczane przez recalc:
                       best_supplier_id, price_net_cents int, price_gross_cents int,
                       stock_total int, stock_status text,  -- 'in_stock'|'low'|'on_order'|'unavailable'
                       lead_time_days int,
                       search_vector tsvector, created_at, updated_at)
product_attributes_def(id, key, label, unit, type, filterable bool, category_ids uuid[], position)
```

### 4.2 Hurtownie
```sql
suppliers             (id, code text unique,  -- 'iglocar'|'autoklima'|'kaisai'|'termosilesia'|'sinclair'|'mock'
                       name, feed_type text,   -- 'api'|'xml'|'csv'|'ftp'|'manual'
                       feed_config jsonb, active bool, priority int, sync_interval_min int default 60,
                       last_sync_at, last_sync_status, last_sync_log text)
supplier_offers       (id, supplier_id, product_id nullable, supplier_sku, ean, name_raw,
                       purchase_net_cents int, stock int, lead_time_days int,
                       raw jsonb, fetched_at, unique(supplier_id, supplier_sku))
product_mappings      (id, supplier_id, supplier_sku, product_id, matched_by text) -- 'ean'|'sku'|'manual'|'ai'
sync_runs             (id, supplier_id, started_at, finished_at, status, items_total, items_new, items_updated, errors jsonb)
```

### 4.3 Ceny i marże
```sql
margin_rules          (id, scope text, -- 'global'|'category'|'brand'|'supplier'|'product'
                       scope_id uuid nullable, margin_pct numeric, min_margin_cents int, priority int, active bool)
customer_groups       (id, code, name, discount_pct numeric, price_mode text) -- 'b2c'|'b2b_standard'|'b2b_vip'
```
Algorytm `recalc_product(product_id)` (SQL function):
1. Weź aktywne `supplier_offers` dla produktu.
2. Wybierz **najtańszą ofertę ze stanem > 0**; jeśli brak — najtańszą z `lead_time_days`.
3. Marża: najbardziej szczegółowa reguła wygrywa (product > supplier > brand > category > global).
4. `price_net = purchase_net × (1 + margin_pct/100)`, nie mniej niż `purchase_net + min_margin_cents`. Zaokrąglenie do pełnych złotych w górę, końcówka `.99`? → **nie**, zaokrąglaj do pełnych groszy; prezentacja `.00`.
5. `price_gross = round(price_net × (1 + vat))`.
6. `stock_total = sum(stock)`, `stock_status` wg progów (0 → unavailable/on_order, 1–3 → low, >3 → in_stock).

### 4.4 Klienci, koszyk, zamówienia
```sql
profiles              (id = auth.users.id, email, full_name, phone, customer_group_id, role text, -- 'customer'|'admin'|'staff'
                       company_name, nip, b2b_approved bool default false, deferred_payment_allowed bool default false)
addresses             (id, profile_id, type 'shipping'|'billing', ...pola PL..., is_default)
carts                 (id, profile_id nullable, session_id, expires_at)
cart_items            (id, cart_id, product_id, qty, price_net_cents_snapshot)
orders                (id, number text unique, -- 'ZAM/2026/000123'
                       profile_id nullable, email, status text, -- 'new'|'awaiting_payment'|'paid'|'processing'|'shipped'|'delivered'|'cancelled'|'refunded'
                       customer_group_code, price_mode,
                       subtotal_net_cents, shipping_net_cents, vat_cents, total_gross_cents,
                       shipping_method, shipping_address jsonb, billing_address jsonb, invoice_requested bool, nip,
                       payment_provider, payment_status, payment_ref, payment_due_date,
                       notes, tracking_number, carrier, created_at, updated_at)
order_items           (id, order_id, product_id, sku, name, qty, price_net_cents, vat_rate, supplier_id, supplier_sku)
order_events          (id, order_id, type, payload jsonb, created_at)  -- audit log
shipping_methods      (id, code, name, carrier, price_net_cents, free_from_cents, max_weight_kg, pallet bool, active)
```

### 4.5 RLS (skrót — pełne w docs/rls.md)
- `products`, `categories`, `brands`, `shipping_methods`: SELECT public (tylko `status='active'`).
- `supplier_offers`, `suppliers`, `margin_rules`, `sync_runs`: tylko `role in ('admin','staff')`.
- `profiles`, `addresses`, `carts`, `orders`: właściciel lub admin.
- Edge Functions używają `service_role` i same sprawdzają uprawnienia.

---

## 5. Funkcjonalności — zakres MVP

### 5.1 Sklep (front)
- [ ] Home: hero, kafle kategorii głównych, bestsellery, sekcja marek (KAISAI, Sinclair + inne z feedów), USP pasek (dostawa paletowa, B2B, doradztwo).
- [ ] Mega menu kategorii (3 poziomy): Klimatyzacja (split, multi-split, kasetonowe, kanałowe, przenośne) / Pompy ciepła (powietrze-woda, monoblok, split, CWU) / Wentylacja i rekuperacja / Czynniki i narzędzia / Akcesoria montażowe (rury miedziane, wsporniki, pompki skroplin, kable) / Serwis i części.
- [ ] Listing: filtry techniczne z `product_attributes_def` (moc kW, klasa energ., czynnik, typ, marka, zasilanie 1f/3f, cena, dostępność), sortowanie, paginacja, widok grid/lista, chipsy aktywnych filtrów, URL state (`?moc=3.5-5&marka=kaisai`).
- [ ] Wyszukiwarka full-text (`search_vector`, trigram na sku/ean) z podpowiedziami.
- [ ] Karta produktu: galeria, cena brutto/netto (przełącznik wg trybu), stan + lead time, tabela parametrów, dokumenty do pobrania, produkty powiązane (jednostka wew. ↔ zew., akcesoria), sticky "Dodaj do koszyka".
- [ ] Koszyk (drawer + strona), zapis dla gości (localStorage + `session_id`) i zalogowanych.
- [ ] Checkout jednostronicowy: dane / adres / dostawa (`calc-shipping`: kurier, paleta gdy `pallet_required` lub waga > próg, odbiór osobisty) / płatność (`manual` na start) / podsumowanie / zgody. Gość lub konto.
- [ ] Potwierdzenie + e-mail (Resend) klient + admin.
- [ ] Konto: zamówienia + statusy + tracking, adresy, dane firmy (NIP → wniosek o konto B2B).
- [ ] B2B: po zatwierdzeniu `b2b_approved` ceny netto, rabat grupy, opcja "płatność odroczona 14 dni" jeśli `deferred_payment_allowed`.
- [ ] SEO: SSR nie jest wymagane na start — ale: czyste slugi, `<title>/<meta>` per strona (react-helmet-async), JSON-LD Product/BreadcrumbList, sitemap.xml generowany Edge Function, canonical.
- [ ] Strony statyczne: Regulamin, Polityka prywatności, Dostawa i płatność, Kontakt, O nas. Cookie consent (Consent Mode v2).

### 5.2 Panel admina (`/admin`, role admin/staff)
- [ ] Dashboard: zamówienia dziś/tydzień, status synchronizacji każdej hurtowni, produkty bez mapowania.
- [ ] Produkty: tabela z inline edit (nazwa, kategoria, status, nadpisanie ceny), podgląd ofert hurtowni per produkt.
- [ ] Mapowanie ofert: lista `supplier_offers` bez `product_id` → dopasuj do produktu / utwórz nowy / ignoruj. Auto-match po EAN, potem po SKU, potem sugestia AI (faza 2).
- [ ] Reguły marż: CRUD + podgląd "jak zmieni się cena 10 przykładowych produktów".
- [ ] Hurtownie: konfiguracja, "Synchronizuj teraz", log ostatnich runów.
- [ ] Zamówienia: board/lista, zmiana statusu, wpis trackingu, notatki, eksport CSV.
- [ ] Klienci: lista, zatwierdzanie B2B, przypisanie grupy, flaga płatności odroczonej.
- [ ] Kategorie, marki, metody dostawy, strony statyczne (prosty edytor).

### 5.3 Poza MVP (nie rób bez decyzji) — zapisane do fazy 3+
- Przelewy24 / PayU / Tpay / Stripe (interfejs gotowy, implementacja później).
- Fakturownia (faktury automatyczne).
- Allegro (wystawianie ofert, sync, zamówienia) i Ceneo (feed) — klient o to pytał; decyzja: bezpośrednio vs BaseLinker — **do ustalenia**.
- Konfigurator doboru klimatyzacji (m² → moc).
- Program lojalnościowy, opinie, porównywarka.

---

## 6. Integracje z hurtowniami

### 6.1 Interfejs adaptera (`adapters/types.ts`)
```ts
export interface SupplierOfferRaw {
  supplierSku: string;
  ean?: string;
  name: string;
  brand?: string;
  categoryPath?: string[];        // ścieżka kategorii hurtowni, mapowana w normalize.ts
  purchaseNetCents: number;
  stock: number;                  // -1 = nieznany
  leadTimeDays?: number;
  attributes?: Record<string, string | number>;
  images?: string[];
  documents?: { name: string; url: string }[];
  raw: unknown;
}

export interface SupplierAdapter {
  code: string;
  fetch(config: Record<string, string>): Promise<SupplierOfferRaw[]>;   // pobierz i sparsuj cały feed
  healthcheck?(config: Record<string, string>): Promise<boolean>;
}
```

### 6.2 Orchestrator `sync-supplier/index.ts`
1. Wejście: `{ supplierCode }` (z pg_cron lub ręcznie z admina). Zapisz `sync_runs` (started).
2. Adapter → `SupplierOfferRaw[]`. Walidacja zod; błędne rekordy do `errors`, nie przerywają runu.
3. Upsert do `supplier_offers` (po `supplier_id + supplier_sku`). Oferty nieobecne w feedzie → `stock = 0`.
4. Auto-mapping: EAN → istniejący produkt; brak → SKU; brak → zostaw `product_id = null` (do ręcznego mapowania). Flaga `auto_create_products` w `feed_config` → tworzy produkt `status='hidden'` do przeglądu.
5. `recalc_product` dla wszystkich dotkniętych produktów (batch, SQL).
6. Zamknij `sync_runs`. Przy błędzie krytycznym: status `failed`, e-mail do admina.
- Harmonogram: pg_cron co 60 min per hurtownia (przesunięte o 10 min każda, żeby nie zderzyć się limitami).
- Limity: feed > 50k pozycji → streaming parser (nie ładuj całości do pamięci).

### 6.3 Hurtownie — co wiemy / co ustalić
Dla każdej hurtowni **najpierw** uzupełnij `docs/suppliers/<code>.md` (format, auth, URL, przykładowy rekord, częstotliwość, czy stany są per magazyn), dopiero potem pisz adapter. Jeśli brak danych dostępowych — adapter rzuca `NotConfiguredError`, a sync pokazuje w adminie status "oczekuje na dane dostępowe".

| Kod | Hurtownia | Asortyment (orientacyjnie) | Format feedu | Status |
|---|---|---|---|---|
| `iglocar` | Igłocar | klimatyzacja, chłodnictwo, czynniki, narzędzia | **do ustalenia** (prawdopodobnie XML/CSV z panelu B2B) | brak dostępów |
| `autoklima` | Autoklima | klimatyzacja, pompy ciepła, akcesoria montażowe | **do ustalenia** (API B2B lub XML) | brak dostępów |
| `kaisai` | KAISAI (producent/dystrybutor) | klimatyzatory, pompy ciepła, rekuperacja KAISAI | **do ustalenia** (platforma partnerska / XML) | brak dostępów |
| `termosilesia` | Termosilesia | klimatyzacja, wentylacja, ogrzewanie | **do ustalenia** | brak dostępów |
| `sinclair` | Sinclair (dystrybutor PL) | klimatyzatory, pompy ciepła Sinclair | **do ustalenia** | brak dostępów |

Pytania do wysłania do każdej hurtowni (wklej do maila):
1. Czy udostępniacie feed produktowy dla partnerów (API REST / XML / CSV / FTP)? Dokumentacja?
2. Czy feed zawiera: EAN, SKU, cenę netto zakupu (cennik partnerski), stan magazynowy, czas dostawy, zdjęcia, karty katalogowe, parametry techniczne?
3. Jak często odświeżane są stany i ceny? Limity zapytań?
4. Czy możliwe jest składanie zamówień przez API (dropshipping) czy tylko ręcznie?
5. Dane dostępowe testowe.

### 6.4 Normalizacja (`normalize.ts`)
- Słownik mapowania kategorii hurtowni → nasze `categories.slug` (plik `category-map.json`, edytowalny z admina w fazie 2).
- Słownik atrybutów: `moc chłodnicza [kW]`, `Moc chł.`, `Cooling capacity` → `moc_chlodnicza_kw` (liczba). Jednostki normalizuj (W → kW, BTU → kW).
- Marka: wyciągana z nazwy jeśli brak pola (lista znanych marek: KAISAI, Sinclair, Gree, Midea, Haier, LG, Samsung, Daikin, Mitsubishi, Rotenso, Panasonic, Fujitsu, Toshiba, Hisense…).

### 6.5 Mock adapter
`mock.ts` zwraca ~60 realistycznych produktów HVAC (3 marki, klimatyzatory split 2.5/3.5/5/7 kW, 2 pompy ciepła, akcesoria) z losowymi stanami. Używaj go do całego developmentu frontu i checkoutu. Supplier `mock` ma `active=false` na produkcji.

---

## 7. Płatności — decyzja: imoje (ING)

```ts
// src/lib/payments/types.ts
export interface PaymentProvider {
  code: 'manual' | 'imoje' | 'p24' | 'payu' | 'tpay' | 'stripe';
  createPayment(order: Order): Promise<{ redirectUrl?: string; instructions?: string }>;
  handleWebhook(req: Request): Promise<{ orderId: string; status: 'paid' | 'failed' | 'pending' }>;
}
```
- `manual`: zamówienie `awaiting_payment`, e-mail z numerem konta i tytułem przelewu = numer zamówienia; admin ręcznie oznacza `paid`.
- B2B z `deferred_payment_allowed`: provider `manual`, `payment_due_date = +14 dni`, status `processing` od razu.
- **`imoje`** (klient wybrał imoje): `create-order` tworzy link płatności (REST `POST /merchant/{merchantId}/payment`) i zwraca `redirectUrl`; `payment-webhook` weryfikuje notyfikacje (`X-Imoje-Signature`, `hash(rawBody + serviceKey)`) i ustawia `paid` / `failed` / `refunded`; `create-payment` generuje ponowny link. Włączane sekretem `PAYMENT_PROVIDERS=manual,imoje` + `IMOJE_*`. Szczegóły: `docs/payments-imoje.md`.
- P24 / PayU / Tpay / Stripe — nie implementować.

---

## 8. Dostawa (`calc-shipping`)
- Wejście: pozycje koszyka (waga, `pallet_required`), kod pocztowy, grupa klienta.
- Reguły: suma wagi ≤ 30 kg i brak palety → kurier (InPost/DPD/DHL — metody z `shipping_methods`); inaczej → "Dostawa paletowa" (cena stała + ewentualna dopłata za windę); zawsze "Odbiór osobisty" jeśli włączony.
- Darmowa dostawa od `free_from_cents` (osobno B2C/B2B).
- Integracje API kurierów (etykiety) — **poza MVP**; admin wpisuje tracking ręcznie.

---

## 9. Plan pracy — fazy

### Faza 0 — Fundament (dzień 1)
1. Pull repo z Lovable, uporządkuj strukturę wg sekcji 3.
2. Migracja 0001: wszystkie tabele z sekcji 4 + `set_updated_at` + `recalc_product` + `search_vector` trigger.
3. RLS + `docs/rls.md`.
4. `seed.sql`: drzewo kategorii HVAC, `product_attributes_def`, `shipping_methods`, `customer_groups`, `margin_rules` (global 18%), supplier `mock`.
5. Mock adapter + orchestrator + uruchomienie syncu → produkty w bazie z cenami.
6. Generacja typów, `npm run typecheck` zielony.

### Faza 1 — Sklep (dni 2–4)
7. Layout, mega menu, Home.
8. Listing + filtry + wyszukiwarka.
9. Karta produktu.
10. Koszyk + checkout + `create-order` + e-maile.
11. Konto klienta.
12. SEO baza + strony statyczne + consent.

### Faza 2 — Admin + B2B (dni 5–6)
13. Admin: dashboard, produkty, mapowanie ofert, marże, hurtownie, zamówienia, klienci.
14. Tryb B2B (ceny netto, rabaty, zatwierdzanie, płatność odroczona).
15. Testy e2e (Playwright): ścieżka gość → zamówienie; B2B → zamówienie odroczone; sync mock → zmiana ceny.

### Faza 3 — Prawdziwe hurtownie (po otrzymaniu dostępów)
16. Per hurtownia: `docs/suppliers/<code>.md` → adapter → test na próbce → pełny sync → ręczne mapowanie resztek w adminie.
17. Harmonogram pg_cron.

### Faza 4 — Do ustalenia
18. ~~Płatności online~~ (imoje — zrobione). 19. Fakturownia. 20. Allegro/Ceneo. 21. Konfigurator doboru.

---

## 10. Definition of Done (każde zadanie)
- `npm run lint && npm run typecheck && npm run test` zielone.
- Migracja działa na czystej bazie (`supabase db reset`).
- RLS sprawdzone: anon nie widzi `supplier_offers`, klient nie widzi cudzych zamówień.
- Mobile 375px bez poziomego scrolla.
- Teksty UI po polsku, bez placeholderów "Lorem".
- Jeśli podjąłeś decyzję architektoniczną → wpis w `docs/decisions.md`.
- Jeśli czegoś nie wiesz (format feedu, dostawca płatności, branding) → **nie zgaduj**: zostaw `TODO(ustalić): ...` i wypisz pytanie w podsumowaniu zadania.

---

## 11. Czego NIE robić
- Nie implementuj innych bramek płatności niż imoje ani API kurierów bez decyzji.
- Nie twórz własnego systemu auth — Supabase Auth.
- Nie przechowuj cen jako float, nie licz VAT na froncie (źródło prawdy: DB / `create-order`).
- Nie ładuj całego feedu hurtowni do pamięci przeglądarki ani do React Query — sync tylko po stronie Edge Functions.
- Nie edytuj `types.ts` ręcznie, nie klikaj migracji w dashboardzie.
- Nie wstawiaj brandingu Xperteo/Enedeal do sklepu.
