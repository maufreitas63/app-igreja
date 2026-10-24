-- Quem já pode contribuir em Dízimos e Ofertas também lista campanhas ativas.
-- O card dashboard.card.campaign está congelado e não entra no grant do membro.

create or replace function public.session_can_view_campaigns()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.profile_has_access(
      public.current_session_profile_id(),
      'screen',
      'dashboard.card.campaign',
      'view'
    )
    or public.profile_has_access(
      public.current_session_profile_id(),
      'screen',
      'dashboard.card.offerings',
      'view'
    )
    or public.session_can_manage_campaigns(),
    false
  );
$$;

grant execute on function public.session_can_view_campaigns() to anon, authenticated;

notify pgrst, 'reload schema';
