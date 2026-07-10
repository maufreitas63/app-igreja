-- =============================================================================
-- Patch: assert_session_profile_matches (e assert_actor_matches_session)
-- =============================================================================
-- Erro ao enviar pedido de oração / pastoral:
--   function public.assert_session_profile_matches(uuid) does not exist
--
-- Causa: RPCs pastorais (multi-tenant-wave1a / pastoral-requests-*) chamam essa
-- função, definida em access-control-security-hardening.sql, mas o hardening
-- completo pode não ter sido aplicado.
--
-- Pré-requisito: current_session_profile_id() (profile-sessions / multi-tenant-09).
-- Execute no SQL Editor do Supabase. Depois hard refresh no app.
-- =============================================================================

begin;

create or replace function public.assert_actor_matches_session(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if public.current_session_profile_id() is null then
    raise exception 'Sessão não identificada. Saia e entre novamente no aplicativo.';
  end if;

  if p_actor_profile_id <> public.current_session_profile_id() then
    raise exception 'Sessão inconsistente com o perfil informado.';
  end if;
end;
$$;

create or replace function public.assert_session_profile_matches(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if public.current_session_profile_id() is null then
    raise exception 'Sessão não identificada.';
  end if;

  if p_profile_id <> public.current_session_profile_id() then
    raise exception 'Operação permitida apenas para o perfil da sessão atual.';
  end if;
end;
$$;

grant execute on function public.assert_actor_matches_session(uuid) to anon, authenticated;
grant execute on function public.assert_session_profile_matches(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Conferência:
-- select p.proname, p.oid::regprocedure
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('assert_session_profile_matches', 'assert_actor_matches_session');
