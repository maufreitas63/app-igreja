-- Membros leem as atas já publicadas no Financeiro (maintenance_assembly_minutes).
-- Isolamento por igreja: policies tenant_* já existentes.
-- Execute: npx supabase db query --linked -f scripts/documentos-oficiais-member-read.sql

drop policy if exists maintenance_assembly_minutes_select on public.maintenance_assembly_minutes;
create policy maintenance_assembly_minutes_select
  on public.maintenance_assembly_minutes
  for select
  to anon, authenticated
  using (
    public.session_has_screen_access('dashboard.card.administrativo', 'view')
    or public.session_has_screen_access('maintenance.card.financials', 'view')
    or public.can_manage_maintenance_support()
    or public.profile_has_role_code(public.current_session_profile_id(), 'member')
  );

drop policy if exists assembly_minutes_storage_select on storage.objects;
create policy assembly_minutes_storage_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'assembly-minutes'
    and (
      public.session_has_screen_access('dashboard.card.administrativo', 'view')
      or public.session_has_screen_access('maintenance.card.financials', 'view')
      or public.can_manage_maintenance_support()
      or public.profile_has_role_code(public.current_session_profile_id(), 'member')
    )
  );

notify pgrst, 'reload schema';
