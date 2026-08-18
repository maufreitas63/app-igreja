-- =============================================================================
-- Ghost + multi-tenant: não zerar current_session_tenant_id no fail-closed
-- =============================================================================
-- Sintoma: operador em IBEP ativa Ghost em membro só da IBN → x-tenant-id=IBEP
-- + perfil efetivo=Alex → profile_can_use_tenant falha → tenant NULL → RLS
-- restritiva em financials (e outras tabelas) devolve zero linhas →
-- "Nenhum mês disponível" no Financeiro.
--
-- Correção: com Ghost válido, se o header de tenant não for usável pelo alvo,
-- usa a igreja primária do perfil ghost (espelha o que o usuário veria).
-- Sem Ghost, mantém fail-closed (não cai na IBN).
-- =============================================================================

create or replace function public.current_session_tenant_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_header_tenant uuid;
  v_tenant_id uuid;
  v_auth_uid uuid;
  v_ghost uuid;
begin
  v_profile_id := public.current_session_profile_id();
  v_header_tenant := public.request_header_tenant_id();
  v_ghost := public.resolve_valid_ghost_profile_id();

  -- Header explícito: aceita só se autorizado para o perfil efetivo.
  if v_profile_id is not null and v_header_tenant is not null then
    if public.profile_can_use_tenant(v_profile_id, v_header_tenant) then
      return v_header_tenant;
    end if;

    -- Modo Ghost: espelha a igreja do alvo em vez de anular a sessão.
    if v_ghost is not null then
      return public.profile_primary_tenant_id(v_profile_id);
    end if;

    -- Sem Ghost: fail-closed (não cai na IBN quando o header IBEP é rejeitado).
    return null;
  end if;

  if v_profile_id is not null then
    v_tenant_id := public.profile_primary_tenant_id(v_profile_id);
    if v_tenant_id is not null then
      return v_tenant_id;
    end if;
  end if;

  begin
    v_auth_uid := auth.uid();
  exception
    when others then
      v_auth_uid := null;
  end;

  if v_auth_uid is not null then
    select public.profile_primary_tenant_id(p.id)
      into v_tenant_id
      from public.profiles p
     where p.auth_user_id = v_auth_uid
     limit 1;
    if v_tenant_id is not null then
      return v_tenant_id;
    end if;
  end if;

  return null;
end;
$$;

grant execute on function public.current_session_tenant_id() to anon, authenticated;

comment on function public.current_session_tenant_id() is
  'Tenant da sessão: header autorizado, ou (em Ghost) igreja primária do alvo; senão fail-closed.';

notify pgrst, 'reload schema';
