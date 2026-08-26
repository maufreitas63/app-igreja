-- =============================================================================
-- Campanhas: centavos simbólicos + chave PIX da instância (app_parameters)
-- =============================================================================
-- Garante campaign_projects.centavos_referencia e busca a chave oficial em
-- app_parameters.chave_pix do tenant da sessão (fallback: igrejas.pix_key).
-- Isolamento: filtro estrito por tenant_id; sessão via current_session_tenant_id.
-- Aplica: npx supabase db query --linked -f scripts/campaign-pix-copia-cola.sql
-- =============================================================================

alter table public.campaign_projects
  add column if not exists centavos_referencia numeric(4, 2);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'campaign_projects_centavos_referencia_check'
  ) then
    alter table public.campaign_projects
      add constraint campaign_projects_centavos_referencia_check
      check (
        centavos_referencia is null
        or (centavos_referencia >= 0.01 and centavos_referencia <= 0.99)
      );
  end if;
end
$$;

comment on column public.campaign_projects.centavos_referencia is
  'Sufixo de centavos (ex.: 0.60) usado para reconhecer depósitos PIX da campanha e segregá-los da receita ordinária.';

create unique index if not exists campaign_projects_tenant_cents_active_idx
  on public.campaign_projects (tenant_id, (round(centavos_referencia * 100)::integer))
  where status in ('rascunho', 'ativo')
    and centavos_referencia is not null;

-- Chave PIX oficial da instância (não cruza tenant).
create or replace function public.get_app_parameter_value(p_parameter text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_value text;
begin
  if v_tenant is null then
    return null;
  end if;

  select ap.value
    into v_value
    from public.app_parameters ap
   where ap.tenant_id = v_tenant
     and lower(trim(ap.parameter)) = lower(trim(p_parameter))
   order by
     case when ap.parameter = trim(p_parameter) then 0 else 1 end,
     ap.parameter
   limit 1;

  return v_value;
end;
$$;

grant execute on function public.get_app_parameter_value(text) to anon, authenticated;

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
  v_pix text;
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

  -- Chave oficial da instância em app_parameters.chave_pix (isolamento por tenant_id).
  select nullif(trim(ap.value), '')
    into v_pix
    from public.app_parameters ap
   where ap.tenant_id = v_tenant
     and lower(trim(ap.parameter)) = 'chave_pix'
   order by
     case when ap.parameter = 'chave_pix' then 0 else 1 end,
     ap.parameter
   limit 1;

  v_pix := coalesce(v_pix, v_row.pix_key);

  return jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'code', v_row.code,
    'name', v_row.name,
    'cnpj', v_row.cnpj,
    'pix_institution', v_row.pix_institution,
    'pix_key', v_pix
  );
end;
$$;

grant execute on function public.get_session_offerings_recipient(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';
