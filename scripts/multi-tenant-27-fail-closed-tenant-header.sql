-- =============================================================================
-- Multi-tenancy 27 — fail-closed do x-tenant-id (proteção IBN em UAT IBEP)
-- =============================================================================
-- Problema: se o app envia x-tenant-id=IBEP mas o servidor rejeita (igreja
-- bloqueada / sem vínculo), current_session_tenant_id() caía no primary (IBN).
-- Sintoma UAT: UI “parece IBEP”, gravações/leituras vão para IBN.
--
-- Correção: header presente e não autorizado → NULL (sem fallback).
-- Ofertas: não usa mais resolve_default_tenant_id() quando há sessão.
--
-- Execute no SQL Editor do Supabase.
-- =============================================================================

begin;

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
begin
  v_profile_id := public.current_session_profile_id();
  v_header_tenant := public.request_header_tenant_id();

  -- Header explícito: aceita só se autorizado; senão fail-closed (não cai na IBN).
  if v_profile_id is not null and v_header_tenant is not null then
    if public.profile_can_use_tenant(v_profile_id, v_header_tenant) then
      return v_header_tenant;
    end if;
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

create or replace function public.get_session_offerings_recipient(p_tenant_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_row record;
begin
  if v_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  -- Sem fallback para IBN: só tenant pedido ou sessão ativa.
  v_tenant := coalesce(p_tenant_id, public.current_session_tenant_id());

  if v_tenant is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Igreja ativa não encontrada. Selecione a instância novamente.'
    );
  end if;

  if not public.profile_can_use_tenant(v_profile_id, v_tenant) then
    return jsonb_build_object('success', false, 'message', 'Sem acesso a esta igreja.');
  end if;

  select
    i.id,
    i.code,
    i.name,
    nullif(trim(i.cnpj), '') as cnpj,
    nullif(trim(i.pix_institution), '') as pix_institution,
    nullif(trim(i.pix_key), '') as pix_key
  into v_row
  from public.igrejas i
  where i.id = v_tenant
    and i.is_active = true;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada ou inativa.');
  end if;

  return jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'code', v_row.code,
    'name', v_row.name,
    'cnpj', v_row.cnpj,
    'pix_institution', v_row.pix_institution,
    'pix_key', v_row.pix_key
  );
end;
$$;

grant execute on function public.get_session_offerings_recipient(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
