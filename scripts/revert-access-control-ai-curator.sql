-- Reverte o módulo de IA no Supabase (tabelas, RPCs, papéis e recursos ACL).
-- Execute no SQL Editor após remover o código do app (commit que cancela o módulo).

-- ---------------------------------------------------------------------------
-- RPCs e funções do módulo IA
-- ---------------------------------------------------------------------------

drop function if exists public.listar_ai_audit_logs_admin(uuid, integer);
drop function if exists public.ia_gemini_esta_configurada_admin(uuid);
drop function if exists public.salvar_chave_gemini_ia_admin(uuid, text);
drop function if exists public.obter_chave_gemini_ia_curador(uuid);
drop function if exists public.registrar_auditoria_ia_actor(uuid, text, text);
drop function if exists public.insert_ai_audit_log(uuid, text, text, text);
drop function if exists public.profile_is_ai_curator(uuid);
drop function if exists public.assert_ai_audit_logs_admin(uuid);
drop function if exists public.profile_role_names_csv(uuid);

-- ---------------------------------------------------------------------------
-- Tabelas e view
-- ---------------------------------------------------------------------------

drop table if exists public.ai_audit_logs cascade;
drop table if exists public.ai_server_config cascade;
drop view if exists public.user_roles cascade;

-- ---------------------------------------------------------------------------
-- ACL: papel Curador IA e recursos de tela
-- ---------------------------------------------------------------------------

delete from public.profile_access_roles par
 using public.access_roles ar
 where par.role_id = ar.id
   and ar.code = 'curador_ia';

delete from public.access_grants ag
 using public.access_resources res
 where ag.resource_id = res.id
   and res.resource_key in (
     'maintenance.card.ai_assistant',
     'maintenance.card.ai_audit_logs'
   );

delete from public.access_resources
 where resource_key in (
   'maintenance.card.ai_assistant',
   'maintenance.card.ai_audit_logs'
 );

delete from public.access_roles
 where code = 'curador_ia';

-- ---------------------------------------------------------------------------
-- Ordem de exibição de papéis (sem curador_ia)
-- ---------------------------------------------------------------------------

create or replace function public.access_role_display_order(p_code text)
returns integer
language sql
immutable
as $$
  select case lower(trim(coalesce(p_code, '')))
    when 'visitantes' then 10
    when 'congregado' then 20
    when 'member' then 30
    when 'family_acceptor' then 40
    when 'lider' then 45
    when 'events_admin' then 50
    when 'orquestrador_evento' then 52
    when 'tesoureiro' then 55
    when 'pastoral' then 60
    when 'super_admin' then 70
    else 100
  end;
$$;

grant execute on function public.access_role_display_order(text) to anon, authenticated;

notify pgrst, 'reload schema';
