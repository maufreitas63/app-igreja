-- Permite super admin registrar solicitação em nome de outro membro (sugestão de terceiros).
-- Execute no SQL Editor do Supabase se o insert falhar com erro de RLS ao salvar Nova sugestão.

drop policy if exists maintenance_support_requests_insert on public.maintenance_support_requests;
create policy maintenance_support_requests_insert
  on public.maintenance_support_requests
  for insert
  to anon, authenticated
  with check (
    public.current_session_profile_id() is not null
    and (
      requester_profile_id = public.current_session_profile_id()
      or public.can_manage_maintenance_support()
    )
  );

notify pgrst, 'reload schema';
