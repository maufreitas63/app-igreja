-- Permite renomear títulos de atas (UPDATE) para quem publica no financeiro.
-- Execute no SQL Editor do Supabase após assembly-minutes.sql.
-- Depois: Settings → API → Reload schema.

drop policy if exists maintenance_assembly_minutes_update on public.maintenance_assembly_minutes;
create policy maintenance_assembly_minutes_update
  on public.maintenance_assembly_minutes
  for update
  to anon, authenticated
  using (
    public.session_has_screen_access('maintenance.card.financials', 'update')
    or public.can_manage_maintenance_support()
  )
  with check (
    public.session_has_screen_access('maintenance.card.financials', 'update')
    or public.can_manage_maintenance_support()
  );

grant update on public.maintenance_assembly_minutes to anon, authenticated;

notify pgrst, 'reload schema';
