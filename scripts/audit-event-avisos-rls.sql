-- RLS de event_avisos: select direto só vê avisos públicos (audience = all).
-- opportunity_match e small_group_leaders continuam só pelas RPCs security definer.
-- Aplica: npx supabase db query --linked -f scripts/audit-event-avisos-rls.sql

drop policy if exists event_avisos_select_published on public.event_avisos;

create policy event_avisos_select_published
  on public.event_avisos
  for select
  to anon, authenticated
  using (
    is_published is true
    and coalesce(audience, 'all') = 'all'
  );

notify pgrst, 'reload schema';
