-- =============================================================================
-- Multi-tenancy 25 — recebedor Dízimos/Ofertas da instância ativa
-- =============================================================================
-- Sintoma: CNPJ / instituição / PIX atualizados em igrejas, mas a tela
-- Dízimos e Ofertas continua "—" / "Chave PIX indisponível".
-- Causa: list_session_igrejas antiga sem essas colunas (ou cache PostgREST).
--
-- Execute no SQL Editor do Supabase.
-- =============================================================================

begin;

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

  v_tenant := coalesce(
    p_tenant_id,
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );

  if v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Igreja ativa não encontrada.');
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
