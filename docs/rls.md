# RLS — polityki tabela po tabeli

Źródło: `supabase/migrations/20261006000002_rls.sql` (polityki) i `20261006000001_schema.sql` (funkcje pomocnicze, triggery). Każda tabela w `public` ma RLS włączone; domyślnie deny — dostęp tylko przez wymienione polityki. `service_role` (Edge Functions, pg_cron) omija RLS.

Role Supabase: `anon` (niezalogowany), `authenticated` (zalogowany, `auth.uid()` = id użytkownika), `service_role` (bypass RLS, `auth.uid()` = null).

## Funkcje pomocnicze

### `is_admin()`
```sql
create or replace function public.is_admin() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce((select role in ('admin','staff') from public.profiles where id = auth.uid()), false);
end; $$;
```
- `SECURITY DEFINER` — czyta `profiles` z pominięciem RLS (inaczej polityka na `profiles` wołałaby `is_admin()` rekurencyjnie).
- `anon` i `service_role` (`auth.uid()` null) → `false`.
- `grant execute ... to anon, authenticated` — frontend może sprawdzić, czy pokazać `/admin`.
- Role `admin` i `staff` są traktowane identycznie w RLS (CLAUDE.md 4.1).

### Trigger `profiles_protect_fields` (BEFORE UPDATE na `profiles`)
Gdy `auth.uid() is not null and not is_admin()` (czyli zwykły klient), zmiany pól **`role`, `customer_group_id`, `b2b_approved`, `deferred_payment_allowed`** są cofane do wartości `old.*` — bez błędu, UPDATE "przechodzi", ale pola pozostają niezmienione. Dodatkowo zmiana `nip` / `company_name` na niepustą wartość ustawia `b2b_requested = true` (wniosek o B2B).
`auth.uid() is null` (service_role, SQL editor, migracje) → bez ograniczeń.

### Trigger `handle_new_user` (AFTER INSERT na `auth.users`, SECURITY DEFINER)
Tworzy `profiles` z `role='customer'` i grupą `b2c`. Klient nie musi (i nie powinien) sam wstawiać profilu.

### Triggery `orders_log_status_change`, `next_order_number`
`SECURITY DEFINER` — piszą do `order_events` / `order_counters` niezależnie od RLS wywołującego.

## Katalog publiczny

### `categories`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `categories_public_read` | SELECT | `true` | anon, authenticated |
| `categories_admin_write` | ALL (INSERT/UPDATE/DELETE) | `is_admin()` (using + with check) | admin/staff |

### `brands`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `brands_public_read` | SELECT | `true` | anon, authenticated |
| `brands_admin_write` | ALL | `is_admin()` | admin/staff |

### `products`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `products_public_read` | SELECT | `status = 'active' or is_admin()` | anon, authenticated widzą tylko `active`; admin wszystko |
| `products_admin_write` | ALL | `is_admin()` | admin/staff |

Uwagi: produkty `hidden` (auto-utworzone z feedu) i `discontinued` są niewidoczne dla klientów. Kolumna `purchase_net_cents` (cena zakupu) i `price_override_net_cents` są w tabeli widocznej publicznie — frontend klienta **nie może** ich wyświetlać; w fazie 2 rozważyć widok `products_public` bez tych kolumn (patrz `docs/decisions.md`). Pola wyliczane zmienia tylko `recalc_product` (SECURITY DEFINER).

### `product_attributes_def`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `attr_def_public_read` | SELECT | `true` | anon, authenticated |
| `attr_def_admin_write` | ALL | `is_admin()` | admin/staff |

### `product_relations`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `relations_public_read` | SELECT | `true` | anon, authenticated |
| `relations_admin_write` | ALL | `is_admin()` | admin/staff |

Uwaga: relacja do produktu `hidden` jest widoczna, ale sam produkt nie (RLS na `products`) — frontend robi join przez `products` i takie wiersze odpadają.

### `shipping_methods`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `shipping_public_read` | SELECT | `active or is_admin()` | anon, authenticated widzą aktywne |
| `shipping_admin_write` | ALL | `is_admin()` | admin/staff |

### `static_pages`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `pages_public_read` | SELECT | `published or is_admin()` | anon, authenticated widzą opublikowane |
| `pages_admin_write` | ALL | `is_admin()` | admin/staff |

### `customer_groups`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `groups_auth_read` | SELECT (`to authenticated`) | `true` | tylko zalogowani |
| `groups_admin_write` | ALL | `is_admin()` | admin/staff |

Uwaga: `anon` nie widzi grup (rabaty B2B nie są publiczne). Frontend gościa zakłada tryb `b2c`.

## Dane hurtowni i marże — tylko admin/staff

| tabela | polityka | operacja | warunek |
|---|---|---|---|
| `suppliers` | `suppliers_admin_all` | ALL | `is_admin()` |
| `supplier_offers` | `offers_admin_all` | ALL | `is_admin()` |
| `product_mappings` | `mappings_admin_all` | ALL | `is_admin()` |
| `sync_runs` | `sync_runs_admin_all` | ALL | `is_admin()` |
| `margin_rules` | `margin_rules_admin_all` | ALL | `is_admin()` |

Uwagi: `anon` i zwykły klient dostają 0 wierszy (nie błąd). Zapis z `sync-supplier` idzie przez `service_role`. Ręczne mapowanie w adminie (UPDATE `supplier_offers.product_id` / `ignored`) uruchamia trigger `supplier_offers_recalc_on_change` → `recalc_product`.

### `order_counters`
RLS włączone, **brak polityk** — żadna rola poza `service_role`/właścicielem bazy nie ma dostępu. Jedyna ścieżka: `next_order_number()` (SECURITY DEFINER, wołana z triggera `orders_set_number` przy INSERT do `orders`). `execute` odebrane `public`, `anon`, `authenticated`.

## Profile i adresy — właściciel lub admin

### `profiles`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `profiles_own_read` | SELECT | `id = auth.uid() or is_admin()` | właściciel, admin |
| `profiles_own_update` | UPDATE | `id = auth.uid() or is_admin()` (using + with check) | właściciel, admin |
| `profiles_own_insert` | INSERT | `id = auth.uid() or is_admin()` | właściciel, admin |

Uwagi: brak polityki DELETE (usunięcie konta kaskadowo przez `auth.users`). Właściciel może edytować `full_name`, `phone`, `company_name`, `nip`; pola administracyjne chroni trigger `profiles_protect_fields` (patrz wyżej). Admin zatwierdza B2B przez UPDATE `b2b_approved`, `customer_group_id`, `deferred_payment_allowed`.

### `addresses`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `addresses_owner_all` | ALL | `profile_id = auth.uid() or is_admin()` (using + with check) | właściciel, admin |

## Koszyki

Koszyk gościa **nie istnieje w DB** — żyje w `localStorage` (zustand persist). Kolumna `carts.session_id` jest zarezerwowana, ale żadna polityka nie daje do niej dostępu roli `anon`. Po zalogowaniu frontend scala koszyk lokalny do `carts/cart_items`.

### `carts`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `carts_owner_all` | ALL | `profile_id = auth.uid() or is_admin()` (using + with check) | zalogowany właściciel, admin |

Unikalny indeks `carts_profile_uidx` — jeden koszyk na profil. `cleanup_expired_carts()` (pg_cron, SECURITY DEFINER) usuwa tylko koszyki z `profile_id is null` po `expires_at`.

### `cart_items`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `cart_items_owner_all` | ALL | `exists (select 1 from carts c where c.id = cart_id and (c.profile_id = auth.uid() or is_admin()))` | właściciel koszyka, admin |

## Zamówienia

Zamówienia tworzy **wyłącznie** Edge Function `create-order` (service_role, pomija RLS). Brak polityki INSERT dla `anon`/`authenticated` — klient nie może sam wstawić zamówienia z dowolnymi kwotami. Gość nie ma dostępu do swojego zamówienia w DB (`profile_id is null`) — potwierdzenie pochodzi z odpowiedzi funkcji.

### `orders`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `orders_owner_read` | SELECT | `(profile_id is not null and profile_id = auth.uid()) or is_admin()` | zalogowany właściciel, admin |
| `orders_admin_update` | UPDATE | `is_admin()` (using + with check) | admin/staff (status, tracking, notatki) |

Brak INSERT (tylko service_role) i DELETE (zamówień nie usuwamy — status `cancelled`).

### `order_items`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `order_items_owner_read` | SELECT | `exists (select 1 from orders o where o.id = order_id and ((o.profile_id is not null and o.profile_id = auth.uid()) or is_admin()))` | właściciel zamówienia, admin |

Brak polityk zapisu — tylko `create-order`.

### `order_events`
| polityka | operacja | warunek | kto |
|---|---|---|---|
| `order_events_owner_read` | SELECT | jak `order_items_owner_read` (przez `orders`) | właściciel zamówienia, admin |
| `order_events_admin_insert` | INSERT | `is_admin()` | admin/staff (notatki, ręczne wpisy) |

Wpisy automatyczne (`created`, `status_changed`, `payment`, `tracking`) dodaje trigger `orders_log_status_change` (SECURITY DEFINER), więc nie wymagają polityki.

## Uprawnienia do RPC (`grant execute`)

| funkcja | anon | authenticated | uwagi |
|---|---|---|---|
| `search_products(text, int, int)` | tak | tak | nie SECURITY DEFINER — RLS na `products` obowiązuje; dodatkowo filtr `status='active'` |
| `category_descendants(uuid)` | tak | tak | |
| `category_ancestors(uuid)` | tak | tak | |
| `category_product_counts()` | tak | tak | liczy przez RLS — anon widzi tylko aktywne |
| `product_facets(uuid, text)` | tak | tak | fasety listingu (atrybuty, marki, zakres cen, dostępność); nie SECURITY DEFINER, filtr `status='active'`, zakres przez `category_descendants` i `search_products` |
| `is_admin()` | tak | tak | |
| `recalc_product(uuid)` | nie | tak | SECURITY DEFINER; tylko przelicza pola pochodne, nic nie zwraca ani nie ujawnia |
| `recalc_products(uuid[])` | nie | tak | j.w. |
| `recalc_all_products()` | nie | tak | j.w.; kosztowna — admin używa po zmianie reguł marż |
| `preview_margin_rule(text, uuid, numeric, int)` | nie | tak | SECURITY DEFINER, ale ma `where is_admin()` — **nie-admin dostaje 0 wierszy** |
| `admin_dashboard_stats()` | nie | tak | SECURITY DEFINER, `case when is_admin() ... else null` — **nie-admin dostaje `null`** |
| `next_order_number()` | nie | nie | tylko service_role / trigger `orders_set_number` |
| `cleanup_expired_carts()` | nie | nie | tylko service_role / pg_cron |
| `resolve_margin_rule(...)` | domyślne | domyślne | nie SECURITY DEFINER — czyta `margin_rules` przez RLS, nie-admin dostaje pusty wynik; używana z `recalc_product` (DEFINER) |

`revoke all ... from public` zapobiega domyślnemu `EXECUTE` dla wszystkich ról na funkcjach wrażliwych.

## Checklista weryfikacji

Zweryfikowane lokalnie na Postgres 16 (`scripts/db-local-reset.sh`, shim `auth.uid()` czytający `request.jwt.claim.sub`). Na projekcie Supabase te same zapytania można wykonać w SQL Editor (`set role` działa tak samo; `request.jwt.claim.sub` zastępuje prawdziwy JWT).

Przygotowanie (jako `postgres` / service_role):
```sql
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'klient@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'inny@example.com'),
  ('99999999-9999-9999-9999-999999999999', 'admin@example.com');
-- trigger handle_new_user utworzył profile; nadaj rolę admina
update public.profiles set role = 'admin' where id = '99999999-9999-9999-9999-999999999999';

-- zamówienia testowe (jak create-order: service_role)
insert into public.orders (profile_id, email, status, total_gross_cents) values
  ('11111111-1111-1111-1111-111111111111', 'klient@example.com', 'new', 100000),
  ('22222222-2222-2222-2222-222222222222', 'inny@example.com', 'new', 200000),
  (null, 'gosc@example.com', 'new', 300000);
```

### 1. Anon: 0 ofert hurtowni, N produktów aktywnych
```sql
set role anon;
select count(*) from public.supplier_offers;          -- oczekiwane: 0
select count(*) from public.suppliers;                -- 0
select count(*) from public.margin_rules;             -- 0
select count(*) from public.products;                 -- N = liczba status='active' (seed: 39)
select count(*) from public.products where status <> 'active';  -- 0
select count(*) from public.customer_groups;          -- 0 (tylko authenticated)
select count(*) from public.orders;                   -- 0
select count(*) from public.search_products('kaisai', 5, 0);     -- > 0
select (public.product_facets(null, null) ->> 'total')::int; -- = N
reset role;
```

### 2. Klient widzi tylko własne zamówienia
```sql
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) from public.orders;                   -- 1 (tylko własne; gość i inny klient niewidoczni)
select count(*) from public.order_items;              -- tylko pozycje własnych zamówień
select count(*) from public.order_events;             -- tylko zdarzenia własnych zamówień
select count(*) from public.profiles;                 -- 1 (własny)
select count(*) from public.supplier_offers;          -- 0
select public.admin_dashboard_stats();                -- null
select count(*) from public.preview_margin_rule('global', null, 20, 0);  -- 0
-- klient NIE może wstawić zamówienia:
insert into public.orders (profile_id, email) values ('11111111-1111-1111-1111-111111111111', 'x@x');
-- oczekiwane: ERROR: new row violates row-level security policy for table "orders"
reset role; reset request.jwt.claim.sub;
```

### 3. Zmiana roli / flag B2B przez klienta jest cofana
```sql
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.profiles
   set role = 'admin', b2b_approved = true, deferred_payment_allowed = true,
       full_name = 'Jan Kowalski', nip = '5252525252', company_name = 'Instal Sp. z o.o.'
 where id = auth.uid();                               -- UPDATE 1 (bez błędu)
select role, b2b_approved, deferred_payment_allowed, b2b_requested, full_name
  from public.profiles where id = auth.uid();
-- oczekiwane: customer | false | false | true | Jan Kowalski
-- cudzy profil: 0 wierszy
update public.profiles set full_name = 'X' where id = '22222222-2222-2222-2222-222222222222';  -- UPDATE 0
reset role; reset request.jwt.claim.sub;
```

### 4. Admin widzi wszystko
```sql
set role authenticated;
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select public.is_admin();                             -- true
select count(*) from public.orders;                   -- 3 (w tym gość)
select count(*) from public.supplier_offers;          -- > 0 (seed: 39)
select count(*) from public.products;                 -- wszystkie statusy
select count(*) from public.profiles;                 -- wszystkie
select public.admin_dashboard_stats() is not null;    -- true
select count(*) from public.preview_margin_rule('global', null, 20, 0);  -- do 10
update public.orders set status = 'processing' where email = 'gosc@example.com';  -- UPDATE 1
select type from public.order_events where order_id = (select id from public.orders where email = 'gosc@example.com');
-- created, status_changed
update public.profiles set b2b_approved = true where id = '11111111-1111-1111-1111-111111111111';  -- UPDATE 1, flaga zostaje
reset role; reset request.jwt.claim.sub;
```

### 5. `order_counters` niedostępne
```sql
set role authenticated;
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select * from public.order_counters;                  -- 0 wierszy (brak polityk, nawet dla admina)
select public.next_order_number();                    -- ERROR: permission denied for function
reset role; reset request.jwt.claim.sub;
```

Definition of Done (CLAUDE.md 10): punkty 1 i 2 muszą przejść po każdej zmianie migracji.
