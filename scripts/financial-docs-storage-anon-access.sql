-- =============================================================================
-- financial-docs Storage: liberar anon (sessão custom do app) + authenticated
-- =============================================================================
-- O cliente Supabase usa a anon key com x-session-token / x-tenant-id.
-- Policies só em "authenticated" bloqueavam upload/leitura de comprovantes e
-- do Resumo Financeiro (RLS), enquanto assembly-minutes / maintenance-support
-- já estavam corretas com {anon, authenticated}.
-- =============================================================================

drop policy if exists financial_docs_select on storage.objects;
drop policy if exists financial_docs_insert on storage.objects;
drop policy if exists financial_docs_update on storage.objects;
drop policy if exists financial_docs_delete on storage.objects;

create policy financial_docs_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'view')
    and public.storage_object_matches_session_tenant(bucket_id, name)
  );

create policy financial_docs_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
    and public.storage_object_matches_session_tenant(bucket_id, name)
  );

create policy financial_docs_update
  on storage.objects
  for update
  to anon, authenticated
  using (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
    and public.storage_object_matches_session_tenant(bucket_id, name)
  )
  with check (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
    and public.storage_object_matches_session_tenant(bucket_id, name)
  );

create policy financial_docs_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
    and public.storage_object_matches_session_tenant(bucket_id, name)
  );

notify pgrst, 'reload schema';

select 'financial-docs-storage-anon-access: ok' as status;
