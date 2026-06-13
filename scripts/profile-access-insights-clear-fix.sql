-- Hotfix: corrige RPC de limpeza (FK + editor Supabase truncando scripts longos).
-- Cole e execute este arquivo inteiro no SQL Editor.

create or replace function public.clear_profile_access_insights_admin(
  p_actor_profile_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $fn_clear_access_insights$
declare
  cnt_before bigint;
  cnt_after bigint;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  select count(*)::bigint into cnt_before from public.profile_app_access_events;

  truncate table
    public.profile_app_access_screen_visits,
    public.profile_app_access_events
  restart identity;

  select count(*)::bigint into cnt_after from public.profile_app_access_events;

  if cnt_after > 0 then
    raise exception 'Falha ao limpar profile_app_access_events (% registros restantes).', cnt_after;
  end if;

  return coalesce(cnt_before, 0);
end;
$fn_clear_access_insights$;

grant execute on function public.clear_profile_access_insights_admin(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
