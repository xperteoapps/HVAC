-- =============================================================================
-- 0001 — Schemat bazy sklepu HVAC (B2C + B2B)
-- Idempotentna: CREATE ... IF NOT EXISTS / CREATE OR REPLACE.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- -----------------------------------------------------------------------------
-- Funkcje pomocnicze
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Czy bieżący użytkownik jest adminem / pracownikiem (SECURITY DEFINER omija RLS na profiles).
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return coalesce(
    (select role in ('admin', 'staff') from public.profiles where id = auth.uid()),
    false
  );
end;
$$;

-- Normalizacja tekstu do wyszukiwania (bez ogonków, lowercase).
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(public.unaccent($1));
$$;

-- -----------------------------------------------------------------------------
-- Katalog
-- -----------------------------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  parent_id uuid references public.categories(id) on delete set null,
  position int not null default 0,
  image_url text,
  description text,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists categories_parent_idx on public.categories(parent_id);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- 'iglocar'|'autoklima'|'kaisai'|'termosilesia'|'sinclair'|'mock'
  name text not null,
  feed_type text not null default 'manual' check (feed_type in ('api','xml','csv','ftp','manual')),
  feed_config jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  priority int not null default 100,
  sync_interval_min int not null default 60,
  last_sync_at timestamptz,
  last_sync_status text,                     -- 'ok'|'failed'|'not_configured'|'running'
  last_sync_log text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  name text not null,
  ean text,
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description_html text,
  attributes jsonb not null default '{}'::jsonb,
  images text[] not null default '{}',
  documents jsonb not null default '[]'::jsonb,   -- [{name, url, type:'karta'|'instrukcja'|'deklaracja'}]
  vat_rate numeric(5,2) not null default 23,
  weight_kg numeric(8,3),
  pallet_required boolean not null default false,
  status text not null default 'active' check (status in ('active','hidden','discontinued')),
  featured boolean not null default false,
  price_override_net_cents integer,          -- ręczne nadpisanie ceny netto przez admina
  -- pola wyliczane przez recalc_product:
  -- UWAGA: cena zakupu NIE jest tu przechowywana (tabela publiczna) — tylko w supplier_offers.
  best_supplier_id uuid references public.suppliers(id) on delete set null,
  price_net_cents integer,
  price_gross_cents integer,
  stock_total integer not null default 0,
  stock_status text not null default 'unavailable' check (stock_status in ('in_stock','low','on_order','unavailable')),
  lead_time_days integer,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_brand_idx on public.products(brand_id);
create index if not exists products_status_idx on public.products(status);
create index if not exists products_ean_idx on public.products(ean);
create index if not exists products_search_idx on public.products using gin(search_vector);
create index if not exists products_attributes_idx on public.products using gin(attributes);
create index if not exists products_name_trgm_idx on public.products using gin (public.f_unaccent(name) gin_trgm_ops);
create index if not exists products_sku_trgm_idx on public.products using gin (sku gin_trgm_ops);

create table if not exists public.product_attributes_def (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                  -- np. 'moc_chlodnicza_kw'
  label text not null,
  unit text,
  type text not null default 'text' check (type in ('number','text','boolean','select')),
  filterable boolean not null default true,
  category_ids uuid[] not null default '{}', -- pusta tablica = wszystkie kategorie
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_relations (
  product_id uuid not null references public.products(id) on delete cascade,
  related_product_id uuid not null references public.products(id) on delete cascade,
  relation_type text not null default 'accessory' check (relation_type in ('accessory','indoor_unit','outdoor_unit','similar')),
  position int not null default 0,
  primary key (product_id, related_product_id, relation_type)
);

-- -----------------------------------------------------------------------------
-- Hurtownie — oferty, mapowania, logi
-- -----------------------------------------------------------------------------

create table if not exists public.supplier_offers (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  supplier_sku text not null,
  ean text,
  name_raw text not null,
  brand_raw text,
  category_path text[],
  purchase_net_cents integer not null check (purchase_net_cents >= 0),
  stock integer not null default 0,          -- -1 = nieznany
  lead_time_days integer,
  active boolean not null default true,      -- false gdy pozycja zniknęła z feedu
  ignored boolean not null default false,    -- admin: nie pokazuj do mapowania
  raw jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, supplier_sku)
);
create index if not exists supplier_offers_product_idx on public.supplier_offers(product_id);
create index if not exists supplier_offers_ean_idx on public.supplier_offers(ean);
create index if not exists supplier_offers_unmapped_idx on public.supplier_offers(supplier_id) where product_id is null and ignored = false;

create table if not exists public.product_mappings (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  supplier_sku text not null,
  product_id uuid not null references public.products(id) on delete cascade,
  matched_by text not null default 'manual' check (matched_by in ('ean','sku','manual','ai','auto_create')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, supplier_sku)
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','failed','not_configured')),
  items_total int not null default 0,
  items_new int not null default 0,
  items_updated int not null default 0,
  items_unmapped int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sync_runs_supplier_idx on public.sync_runs(supplier_id, started_at desc);

-- -----------------------------------------------------------------------------
-- Ceny i marże
-- -----------------------------------------------------------------------------

create table if not exists public.margin_rules (
  id uuid primary key default gen_random_uuid(),
  name text,
  scope text not null check (scope in ('global','category','brand','supplier','product')),
  scope_id uuid,
  margin_pct numeric(6,2) not null default 0,
  min_margin_cents integer not null default 0,
  priority int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists margin_rules_scope_idx on public.margin_rules(scope, scope_id) where active;

create table if not exists public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- 'b2c'|'b2b_standard'|'b2b_vip'
  name text not null,
  discount_pct numeric(5,2) not null default 0,
  price_mode text not null default 'gross' check (price_mode in ('gross','net')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Klienci, adresy, koszyk
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  customer_group_id uuid references public.customer_groups(id) on delete set null,
  role text not null default 'customer' check (role in ('customer','admin','staff')),
  company_name text,
  nip text,
  b2b_requested boolean not null default false,
  b2b_approved boolean not null default false,
  deferred_payment_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'shipping' check (type in ('shipping','billing')),
  full_name text not null,
  company_name text,
  nip text,
  street text not null,
  building_no text not null,
  apartment_no text,
  postal_code text not null,
  city text not null,
  country text not null default 'PL',
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists addresses_profile_idx on public.addresses(profile_id);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  session_id text,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists carts_profile_uidx on public.carts(profile_id) where profile_id is not null;
create unique index if not exists carts_session_uidx on public.carts(session_id) where session_id is not null;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty int not null check (qty > 0),
  price_net_cents_snapshot integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

-- -----------------------------------------------------------------------------
-- Dostawa, zamówienia
-- -----------------------------------------------------------------------------

create table if not exists public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  carrier text,
  description text,
  price_net_cents integer not null default 0,
  free_from_cents integer,                   -- B2C: darmowa dostawa od (brutto)
  free_from_cents_b2b integer,               -- B2B: darmowa dostawa od (netto)
  max_weight_kg numeric(8,3),                -- null = bez limitu
  pallet boolean not null default false,     -- metoda paletowa
  pickup boolean not null default false,     -- odbiór osobisty
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_counters (
  year int primary key,
  last_number int not null default 0
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,               -- 'ZAM/2026/000123'
  profile_id uuid references public.profiles(id) on delete set null,
  email text not null,
  phone text,
  status text not null default 'new' check (status in ('new','awaiting_payment','paid','processing','shipped','delivered','cancelled','refunded')),
  customer_group_code text not null default 'b2c',
  price_mode text not null default 'gross' check (price_mode in ('gross','net')),
  subtotal_net_cents integer not null default 0,
  discount_pct numeric(5,2) not null default 0,
  shipping_net_cents integer not null default 0,
  vat_cents integer not null default 0,
  total_gross_cents integer not null default 0,
  shipping_method text,
  shipping_address jsonb not null default '{}'::jsonb,
  billing_address jsonb,
  invoice_requested boolean not null default false,
  nip text,
  payment_provider text not null default 'manual',
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','deferred','refunded')),
  payment_ref text,
  payment_due_date date,
  notes text,
  admin_notes text,
  tracking_number text,
  carrier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_profile_idx on public.orders(profile_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_idx on public.orders(created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text not null,
  name text not null,
  image_url text,
  qty int not null check (qty > 0),
  price_net_cents integer not null,          -- cena jednostkowa netto po rabacie
  vat_rate numeric(5,2) not null default 23,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_sku text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,                        -- 'created'|'status_changed'|'payment'|'note'|'email_sent'|'tracking'
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events(order_id, created_at);

create table if not exists public.static_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_html text not null default '',
  seo_title text,
  seo_description text,
  published boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Triggery updated_at
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories','brands','suppliers','products','product_attributes_def','supplier_offers',
    'product_mappings','sync_runs','margin_rules','customer_groups','profiles','addresses',
    'carts','cart_items','shipping_methods','orders','order_items','static_pages'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Wyszukiwarka: search_vector
-- -----------------------------------------------------------------------------

create or replace function public.products_search_vector_update()
returns trigger
language plpgsql
as $$
declare
  v_brand text;
begin
  select name into v_brand from public.brands where id = new.brand_id;
  new.search_vector :=
    setweight(to_tsvector('simple', public.f_unaccent(coalesce(new.name, ''))), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.sku, '') || ' ' || coalesce(new.ean, '')), 'A') ||
    setweight(to_tsvector('simple', public.f_unaccent(coalesce(v_brand, ''))), 'B') ||
    setweight(to_tsvector('simple', public.f_unaccent(coalesce(regexp_replace(new.description_html, '<[^>]+>', ' ', 'g'), ''))), 'C');
  return new;
end;
$$;

drop trigger if exists products_search_vector on public.products;
create trigger products_search_vector
  before insert or update of name, sku, ean, brand_id, description_html on public.products
  for each row execute function public.products_search_vector_update();

-- RPC: wyszukiwanie full-text + trigram (podpowiedzi i strona wyników).
create or replace function public.search_products(p_query text, lim int default 20, off int default 0)
returns table (
  id uuid, sku text, slug text, name text, brand_id uuid, category_id uuid, images text[],
  price_net_cents int, price_gross_cents int, vat_rate numeric, stock_status text, stock_total int,
  lead_time_days int, attributes jsonb, rank real, total_count bigint
)
language sql
stable
as $$
  with qry as (
    select
      public.f_unaccent(trim(p_query)) as nq,
      websearch_to_tsquery('simple', public.f_unaccent(trim(p_query))) as tsq
  ),
  hits as (
    select p.*,
      (coalesce(ts_rank(p.search_vector, qry.tsq), 0)
        + greatest(similarity(public.f_unaccent(p.name), qry.nq), similarity(p.sku, qry.nq)) * 2)::real as rank
    from public.products p, qry
    where p.status = 'active'
      and (
        p.search_vector @@ qry.tsq
        or public.f_unaccent(p.name) % qry.nq
        or p.sku % qry.nq
        or lower(p.sku) like qry.nq || '%'
        or p.ean = trim(p_query)
      )
  )
  select h.id, h.sku, h.slug, h.name, h.brand_id, h.category_id, h.images,
         h.price_net_cents, h.price_gross_cents, h.vat_rate, h.stock_status, h.stock_total,
         h.lead_time_days, h.attributes, h.rank, count(*) over () as total_count
  from hits h
  order by h.rank desc, h.name
  limit lim offset off;
$$;

-- -----------------------------------------------------------------------------
-- Kategorie: potomkowie (do listingu) i przodkowie (do marż / breadcrumbs)
-- -----------------------------------------------------------------------------

create or replace function public.category_descendants(p_category_id uuid)
returns setof uuid
language sql
stable
as $$
  with recursive tree as (
    select id from public.categories where id = p_category_id
    union all
    select c.id from public.categories c join tree t on c.parent_id = t.id
  )
  select id from tree;
$$;

create or replace function public.category_ancestors(p_category_id uuid)
returns table (id uuid, depth int)
language sql
stable
as $$
  with recursive tree as (
    select id, parent_id, 0 as depth from public.categories where id = p_category_id
    union all
    select c.id, c.parent_id, t.depth + 1 from public.categories c join tree t on c.id = t.parent_id
  )
  select id, depth from tree;
$$;

-- Liczba produktów per kategoria (z potomkami) — do mega menu i filtrów.
create or replace function public.category_product_counts()
returns table (category_id uuid, product_count bigint)
language sql
stable
as $$
  select c.id, count(p.id)
  from public.categories c
  left join public.products p
    on p.status = 'active' and p.category_id in (select public.category_descendants(c.id))
  group by c.id;
$$;

-- -----------------------------------------------------------------------------
-- recalc_product — wybór oferty, marża, cena, stan
-- -----------------------------------------------------------------------------

create or replace function public.resolve_margin_rule(
  p_product_id uuid, p_supplier_id uuid, p_brand_id uuid, p_category_id uuid
)
returns table (margin_pct numeric, min_margin_cents int)
language sql
stable
as $$
  with candidates as (
    select r.margin_pct, r.min_margin_cents, r.priority,
      case r.scope
        when 'product'  then 500
        when 'supplier' then 400
        when 'brand'    then 300
        when 'category' then 200 - coalesce(a.depth, 0)   -- bliższa kategoria wygrywa
        else 100
      end as specificity
    from public.margin_rules r
    left join public.category_ancestors(p_category_id) a
      on r.scope = 'category' and r.scope_id = a.id
    where r.active
      and (
        (r.scope = 'global') or
        (r.scope = 'product'  and r.scope_id = p_product_id) or
        (r.scope = 'supplier' and r.scope_id = p_supplier_id) or
        (r.scope = 'brand'    and r.scope_id = p_brand_id) or
        (r.scope = 'category' and a.id is not null)
      )
  )
  select margin_pct, min_margin_cents
  from candidates
  order by specificity desc, priority desc
  limit 1;
$$;

create or replace function public.recalc_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_offer_id uuid;
  v_offer_supplier_id uuid;
  v_offer_purchase int;
  v_offer_lead int;
  v_margin_pct numeric := 0;
  v_min_margin int := 0;
  v_price_net int;
  v_price_gross int;
  v_stock_total int;
  v_stock_status text;
begin
  select * into v_product from public.products where id = p_product_id;
  if not found then
    return;
  end if;

  -- 1-2. Najtańsza oferta ze stanem > 0; jeśli brak — najtańsza z lead_time_days.
  select o.id, o.supplier_id, o.purchase_net_cents, o.lead_time_days
    into v_offer_id, v_offer_supplier_id, v_offer_purchase, v_offer_lead
  from public.supplier_offers o
  join public.suppliers s on s.id = o.supplier_id and s.active
  where o.product_id = p_product_id and o.active
  order by
    (case when o.stock > 0 then 0 when o.lead_time_days is not null then 1 else 2 end),
    o.purchase_net_cents asc,
    s.priority asc
  limit 1;

  -- 6. Stan łączny (stock -1 = nieznany → 0).
  select coalesce(sum(greatest(o.stock, 0)), 0) into v_stock_total
  from public.supplier_offers o
  join public.suppliers s on s.id = o.supplier_id and s.active
  where o.product_id = p_product_id and o.active;

  if v_stock_total > 3 then
    v_stock_status := 'in_stock';
  elsif v_stock_total >= 1 then
    v_stock_status := 'low';
  elsif v_offer_id is not null and v_offer_lead is not null then
    v_stock_status := 'on_order';
  else
    v_stock_status := 'unavailable';
  end if;

  -- 3-4. Marża i cena netto.
  if v_product.price_override_net_cents is not null then
    v_price_net := v_product.price_override_net_cents;
  elsif v_offer_id is not null then
    select margin_pct, min_margin_cents into v_margin_pct, v_min_margin
    from public.resolve_margin_rule(p_product_id, v_offer_supplier_id, v_product.brand_id, v_product.category_id);
    v_margin_pct := coalesce(v_margin_pct, 0);
    v_min_margin := coalesce(v_min_margin, 0);
    v_price_net := greatest(
      round(v_offer_purchase * (1 + v_margin_pct / 100))::int,
      v_offer_purchase + v_min_margin
    );
  else
    v_price_net := null;
  end if;

  -- 5. Brutto.
  if v_price_net is not null then
    v_price_gross := round(v_price_net * (1 + coalesce(v_product.vat_rate, 23) / 100))::int;
  else
    v_price_gross := null;
  end if;

  update public.products set
    best_supplier_id = v_offer_supplier_id,
    price_net_cents = v_price_net,
    price_gross_cents = v_price_gross,
    stock_total = v_stock_total,
    stock_status = case when v_price_net is null then 'unavailable' else v_stock_status end,
    lead_time_days = case when v_stock_total > 0 then null else v_offer_lead end
  where id = p_product_id;
end;
$$;

create or replace function public.recalc_products(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  n int := 0;
begin
  foreach v_id in array p_ids loop
    perform public.recalc_product(v_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.recalc_all_products()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
begin
  for r in select id from public.products loop
    perform public.recalc_product(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Podgląd zmiany ceny dla reguły marży (admin): zwraca 10 przykładowych produktów.
create or replace function public.preview_margin_rule(
  p_scope text, p_scope_id uuid, p_margin_pct numeric, p_min_margin_cents int
)
returns table (product_id uuid, sku text, name text, purchase_net_cents int, current_price_net_cents int, new_price_net_cents int)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.sku, p.name, o.purchase_net_cents, p.price_net_cents,
    greatest(
      round(o.purchase_net_cents * (1 + p_margin_pct / 100))::int,
      o.purchase_net_cents + p_min_margin_cents
    ) as new_price_net_cents
  from public.products p
  join public.supplier_offers o on o.product_id = p.id and o.supplier_id = p.best_supplier_id
  where public.is_admin()
    and p.price_override_net_cents is null
    and (
      p_scope = 'global'
      or (p_scope = 'product' and p.id = p_scope_id)
      or (p_scope = 'brand' and p.brand_id = p_scope_id)
      or (p_scope = 'supplier' and p.best_supplier_id = p_scope_id)
      or (p_scope = 'category' and p.category_id in (select public.category_descendants(p_scope_id)))
    )
  order by p.updated_at desc
  limit 10;
$$;

-- Przelicz produkt po zmianie nadpisania ceny / VAT.
create or replace function public.products_recalc_on_change()
returns trigger
language plpgsql
as $$
begin
  if (new.price_override_net_cents is distinct from old.price_override_net_cents)
     or (new.vat_rate is distinct from old.vat_rate) then
    perform public.recalc_product(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists products_recalc_on_change on public.products;
create trigger products_recalc_on_change
  after update of price_override_net_cents, vat_rate on public.products
  for each row execute function public.products_recalc_on_change();

-- Przelicz produkt po ręcznym mapowaniu oferty (zmiana product_id / ignored).
create or replace function public.supplier_offers_recalc_on_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.product_id is not null then perform public.recalc_product(old.product_id); end if;
    return null;
  end if;
  if tg_op = 'UPDATE' and old.product_id is not null and old.product_id is distinct from new.product_id then
    perform public.recalc_product(old.product_id);
  end if;
  if new.product_id is not null then
    perform public.recalc_product(new.product_id);
  end if;
  return null;
end;
$$;
drop trigger if exists supplier_offers_recalc_on_change on public.supplier_offers;
create trigger supplier_offers_recalc_on_change
  after update of product_id, active, stock, purchase_net_cents, lead_time_days or delete on public.supplier_offers
  for each row execute function public.supplier_offers_recalc_on_change();

-- -----------------------------------------------------------------------------
-- Numeracja zamówień: ZAM/<rok>/<000123>
-- -----------------------------------------------------------------------------

create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_next int;
begin
  insert into public.order_counters(year, last_number) values (v_year, 1)
  on conflict (year) do update set last_number = public.order_counters.last_number + 1
  returning last_number into v_next;
  return format('ZAM/%s/%s', v_year, lpad(v_next::text, 6, '0'));
end;
$$;

create or replace function public.orders_set_number()
returns trigger
language plpgsql
as $$
begin
  if new.number is null or new.number = '' then
    new.number := public.next_order_number();
  end if;
  return new;
end;
$$;
drop trigger if exists orders_set_number on public.orders;
create trigger orders_set_number before insert on public.orders
  for each row execute function public.orders_set_number();

-- Audit: zmiana statusu zamówienia → order_events.
create or replace function public.orders_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events(order_id, type, payload, created_by)
    values (new.id, 'created', jsonb_build_object('status', new.status, 'total_gross_cents', new.total_gross_cents), auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_events(order_id, type, payload, created_by)
    values (new.id, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status), auth.uid());
  end if;
  if tg_op = 'UPDATE' and new.payment_status is distinct from old.payment_status then
    insert into public.order_events(order_id, type, payload, created_by)
    values (new.id, 'payment', jsonb_build_object('from', old.payment_status, 'to', new.payment_status), auth.uid());
  end if;
  if tg_op = 'UPDATE' and new.tracking_number is distinct from old.tracking_number then
    insert into public.order_events(order_id, type, payload, created_by)
    values (new.id, 'tracking', jsonb_build_object('tracking_number', new.tracking_number, 'carrier', new.carrier), auth.uid());
  end if;
  return null;
end;
$$;
drop trigger if exists orders_log_status_change on public.orders;
create trigger orders_log_status_change after insert or update on public.orders
  for each row execute function public.orders_log_status_change();

-- -----------------------------------------------------------------------------
-- Profile: auto-tworzenie po rejestracji + ochrona pól administracyjnych
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, customer_group_id)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    (select id from public.customer_groups where code = 'b2c')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Klient nie może sam zmienić roli, grupy, zatwierdzenia B2B ani płatności odroczonej.
create or replace function public.profiles_protect_fields()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() is null = service_role / SQL editor → bez ograniczeń
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.customer_group_id := old.customer_group_id;
    new.b2b_approved := old.b2b_approved;
    new.deferred_payment_allowed := old.deferred_payment_allowed;
    -- zmiana NIP/firmy przez klienta = ponowny wniosek, jeśli nie był zatwierdzony
    if (new.nip is distinct from old.nip or new.company_name is distinct from old.company_name)
       and new.nip is not null and new.nip <> '' then
      new.b2b_requested := true;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields before update on public.profiles
  for each row execute function public.profiles_protect_fields();

-- -----------------------------------------------------------------------------
-- Statystyki admina
-- -----------------------------------------------------------------------------

create or replace function public.admin_dashboard_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_admin() then jsonb_build_object(
    'orders_today', (select count(*) from public.orders where created_at >= date_trunc('day', now())),
    'orders_week', (select count(*) from public.orders where created_at >= date_trunc('week', now())),
    'revenue_week_gross_cents', (select coalesce(sum(total_gross_cents), 0) from public.orders where created_at >= date_trunc('week', now()) and status not in ('cancelled','refunded')),
    'orders_awaiting', (select count(*) from public.orders where status in ('new','awaiting_payment','paid')),
    'products_active', (select count(*) from public.products where status = 'active'),
    'products_hidden', (select count(*) from public.products where status = 'hidden'),
    'offers_unmapped', (select count(*) from public.supplier_offers where product_id is null and ignored = false and active),
    'b2b_pending', (select count(*) from public.profiles where b2b_requested and not b2b_approved)
  ) else null end;
$$;

-- Czyszczenie wygasłych koszyków gości (wywoływane z pg_cron).
create or replace function public.cleanup_expired_carts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  delete from public.carts where expires_at < now() and profile_id is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fasety do filtrów listingu: wartości atrybutów, marki, zakres cen w kategorii
-- -----------------------------------------------------------------------------
create or replace function public.product_facets(p_category_id uuid default null, p_search text default null)
returns jsonb
language sql
stable
as $$
  with scope as (
    select p.*
    from public.products p
    where p.status = 'active'
      and (p_category_id is null or p.category_id in (select public.category_descendants(p_category_id)))
      and (p_search is null or p.id in (select id from public.search_products(p_search, 10000, 0)))
  ),
  attr_values as (
    select d.key, d.label, d.unit, d.type, d.position,
           jsonb_agg(jsonb_build_object('value', v.value, 'count', v.cnt) order by
             case when d.type = 'number' then (v.value)::numeric else null end,
             v.value) as values
    from public.product_attributes_def d
    join lateral (
      select s.attributes ->> d.key as value, count(*) as cnt
      from scope s
      where s.attributes ? d.key
        and (cardinality(d.category_ids) = 0 or p_category_id = any(d.category_ids) or p_category_id is null)
      group by s.attributes ->> d.key
    ) v on true
    where d.filterable
    group by d.key, d.label, d.unit, d.type, d.position
  ),
  brand_values as (
    select jsonb_agg(jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'count', c.cnt) order by b.name) as brands
    from (select brand_id, count(*) as cnt from scope where brand_id is not null group by brand_id) c
    join public.brands b on b.id = c.brand_id
  )
  select jsonb_build_object(
    'attributes', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'unit', unit, 'type', type, 'values', values) order by position) from attr_values), '[]'::jsonb),
    'brands', coalesce((select brands from brand_values), '[]'::jsonb),
    'price_min', (select min(price_gross_cents) from scope),
    'price_max', (select max(price_gross_cents) from scope),
    'total', (select count(*) from scope),
    'availability', jsonb_build_object(
      'in_stock', (select count(*) from scope where stock_status in ('in_stock','low')),
      'on_order', (select count(*) from scope where stock_status = 'on_order')
    )
  );
$$;
