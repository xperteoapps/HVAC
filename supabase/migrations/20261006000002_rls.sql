-- =============================================================================
-- 0002 — Row Level Security. Domyślnie deny; pełny opis w docs/rls.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Katalog publiczny: SELECT dla wszystkich (tylko aktywne), zapis tylko admin.
-- -----------------------------------------------------------------------------
alter table public.categories enable row level security;
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select using (true);
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories for all using (public.is_admin()) with check (public.is_admin());

alter table public.brands enable row level security;
drop policy if exists brands_public_read on public.brands;
create policy brands_public_read on public.brands for select using (true);
drop policy if exists brands_admin_write on public.brands;
create policy brands_admin_write on public.brands for all using (public.is_admin()) with check (public.is_admin());

alter table public.products enable row level security;
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (status = 'active' or public.is_admin());
drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all using (public.is_admin()) with check (public.is_admin());

alter table public.product_attributes_def enable row level security;
drop policy if exists attr_def_public_read on public.product_attributes_def;
create policy attr_def_public_read on public.product_attributes_def for select using (true);
drop policy if exists attr_def_admin_write on public.product_attributes_def;
create policy attr_def_admin_write on public.product_attributes_def for all using (public.is_admin()) with check (public.is_admin());

alter table public.product_relations enable row level security;
drop policy if exists relations_public_read on public.product_relations;
create policy relations_public_read on public.product_relations for select using (true);
drop policy if exists relations_admin_write on public.product_relations;
create policy relations_admin_write on public.product_relations for all using (public.is_admin()) with check (public.is_admin());

alter table public.shipping_methods enable row level security;
drop policy if exists shipping_public_read on public.shipping_methods;
create policy shipping_public_read on public.shipping_methods for select using (active or public.is_admin());
drop policy if exists shipping_admin_write on public.shipping_methods;
create policy shipping_admin_write on public.shipping_methods for all using (public.is_admin()) with check (public.is_admin());

alter table public.static_pages enable row level security;
drop policy if exists pages_public_read on public.static_pages;
create policy pages_public_read on public.static_pages for select using (published or public.is_admin());
drop policy if exists pages_admin_write on public.static_pages;
create policy pages_admin_write on public.static_pages for all using (public.is_admin()) with check (public.is_admin());

alter table public.customer_groups enable row level security;
drop policy if exists groups_auth_read on public.customer_groups;
create policy groups_auth_read on public.customer_groups for select to authenticated using (true);
drop policy if exists groups_admin_write on public.customer_groups;
create policy groups_admin_write on public.customer_groups for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Dane hurtowni i marże: tylko admin/staff.
-- -----------------------------------------------------------------------------
alter table public.suppliers enable row level security;
drop policy if exists suppliers_admin_all on public.suppliers;
create policy suppliers_admin_all on public.suppliers for all using (public.is_admin()) with check (public.is_admin());

alter table public.supplier_offers enable row level security;
drop policy if exists offers_admin_all on public.supplier_offers;
create policy offers_admin_all on public.supplier_offers for all using (public.is_admin()) with check (public.is_admin());

alter table public.product_mappings enable row level security;
drop policy if exists mappings_admin_all on public.product_mappings;
create policy mappings_admin_all on public.product_mappings for all using (public.is_admin()) with check (public.is_admin());

alter table public.sync_runs enable row level security;
drop policy if exists sync_runs_admin_all on public.sync_runs;
create policy sync_runs_admin_all on public.sync_runs for all using (public.is_admin()) with check (public.is_admin());

alter table public.margin_rules enable row level security;
drop policy if exists margin_rules_admin_all on public.margin_rules;
create policy margin_rules_admin_all on public.margin_rules for all using (public.is_admin()) with check (public.is_admin());

alter table public.order_counters enable row level security;
-- brak polityk: dostęp wyłącznie przez next_order_number() (security definer)

-- -----------------------------------------------------------------------------
-- Profile i adresy: właściciel lub admin.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_own_insert on public.profiles;
create policy profiles_own_insert on public.profiles for insert with check (id = auth.uid() or public.is_admin());

alter table public.addresses enable row level security;
drop policy if exists addresses_owner_all on public.addresses;
create policy addresses_owner_all on public.addresses for all
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Koszyki: zalogowany właściciel (koszyk gościa żyje w localStorage).
-- -----------------------------------------------------------------------------
alter table public.carts enable row level security;
drop policy if exists carts_owner_all on public.carts;
create policy carts_owner_all on public.carts for all
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

alter table public.cart_items enable row level security;
drop policy if exists cart_items_owner_all on public.cart_items;
create policy cart_items_owner_all on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and (c.profile_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.carts c where c.id = cart_id and (c.profile_id = auth.uid() or public.is_admin())));

-- -----------------------------------------------------------------------------
-- Zamówienia: odczyt właściciel/admin; INSERT wyłącznie przez create-order
-- (service_role); UPDATE tylko admin.
-- -----------------------------------------------------------------------------
alter table public.orders enable row level security;
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders for select
  using ((profile_id is not null and profile_id = auth.uid()) or public.is_admin());
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update using (public.is_admin()) with check (public.is_admin());

alter table public.order_items enable row level security;
drop policy if exists order_items_owner_read on public.order_items;
create policy order_items_owner_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and ((o.profile_id is not null and o.profile_id = auth.uid()) or public.is_admin())));

alter table public.order_events enable row level security;
drop policy if exists order_events_owner_read on public.order_events;
create policy order_events_owner_read on public.order_events for select
  using (exists (select 1 from public.orders o where o.id = order_id and ((o.profile_id is not null and o.profile_id = auth.uid()) or public.is_admin())));
drop policy if exists order_events_admin_insert on public.order_events;
create policy order_events_admin_insert on public.order_events for insert with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Uprawnienia do RPC
-- -----------------------------------------------------------------------------
revoke all on function public.recalc_product(uuid) from public, anon;
revoke all on function public.recalc_products(uuid[]) from public, anon;
revoke all on function public.recalc_all_products() from public, anon;
revoke all on function public.preview_margin_rule(text, uuid, numeric, int) from public, anon;
revoke all on function public.next_order_number() from public, anon, authenticated;
revoke all on function public.cleanup_expired_carts() from public, anon, authenticated;
revoke all on function public.admin_dashboard_stats() from public, anon;

grant execute on function public.search_products(text, int, int) to anon, authenticated;
grant execute on function public.category_descendants(uuid) to anon, authenticated;
grant execute on function public.category_ancestors(uuid) to anon, authenticated;
grant execute on function public.category_product_counts() to anon, authenticated;
grant execute on function public.product_facets(uuid, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.recalc_product(uuid) to authenticated;       -- tylko przelicza pola pochodne, nie ujawnia danych
grant execute on function public.recalc_products(uuid[]) to authenticated;
grant execute on function public.recalc_all_products() to authenticated;
grant execute on function public.preview_margin_rule(text, uuid, numeric, int) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
