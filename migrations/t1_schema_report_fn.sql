-- T1 검증용 스키마 introspection RPC (service_role 전용, 읽기 전용)
-- scripts/verify-t1-schema.mjs 가 이 함수를 호출한다.
-- anon/authenticated 에게는 EXECUTE 를 주지 않는다(스키마 정보 노출 방지).
create or replace function public.t1_schema_report()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'tables', (
      select coalesce(jsonb_object_agg(c.relname, c.relrowsecurity), '{}'::jsonb)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    ),
    'constraints', (
      select coalesce(jsonb_agg(distinct con.conname), '[]'::jsonb)
      from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace
      where n.nspname = 'public'
    ),
    'indexes', (
      select coalesce(jsonb_agg(distinct i.indexname), '[]'::jsonb)
      from pg_indexes i
      where i.schemaname = 'public'
    ),
    'columns', (
      select coalesce(jsonb_agg(distinct (a.attrelid::regclass::text || '.' || a.attname)), '[]'::jsonb)
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
    )
  );
$$;

revoke all on function public.t1_schema_report() from public;
revoke all on function public.t1_schema_report() from anon, authenticated;
grant execute on function public.t1_schema_report() to service_role;
