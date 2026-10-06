-- =============================================================================
-- 0003 — Harmonogram pg_cron (sync hurtowni, czyszczenie koszyków)
-- Wymaga rozszerzeń pg_cron i pg_net (włączane w Supabase Dashboard → Database →
-- Extensions). Blok jest bezpieczny, gdy rozszerzeń brak — tylko loguje NOTICE.
--
-- Wywołanie Edge Function wymaga ustawienia w Vault / app settings:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service_role_key>', 'service_role_key');
-- TODO(ustalić): docelowe godziny syncu po otrzymaniu limitów API hurtowni.
-- =============================================================================

create or replace function public.schedule_supplier_sync(p_code text, p_cron text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
  v_job text := 'sync-supplier-' || p_code;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron nie jest włączony — pomijam harmonogram %', v_job;
    return;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_net nie jest włączony — pomijam harmonogram %', v_job;
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_url is null or v_key is null then
    raise notice 'Brak sekretów project_url / service_role_key w Vault — pomijam harmonogram %', v_job;
    return;
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = v_job;
  perform cron.schedule(
    v_job,
    p_cron,
    format(
      $sql$select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || %L),
        body := jsonb_build_object('supplierCode', %L, 'source', 'cron')
      );$sql$,
      v_url || '/functions/v1/sync-supplier', v_key, p_code
    )
  );
end;
$$;

-- Co 60 min, każda hurtownia przesunięta o 10 min.
select public.schedule_supplier_sync('iglocar',      '0 * * * *');
select public.schedule_supplier_sync('autoklima',    '10 * * * *');
select public.schedule_supplier_sync('kaisai',       '20 * * * *');
select public.schedule_supplier_sync('termosilesia', '30 * * * *');
select public.schedule_supplier_sync('sinclair',     '40 * * * *');

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-expired-carts';
    perform cron.schedule('cleanup-expired-carts', '15 3 * * *', 'select public.cleanup_expired_carts();');
  end if;
end;
$$;
