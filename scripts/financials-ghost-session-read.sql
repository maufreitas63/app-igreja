-- =============================================================================
-- Financeiro no Ghost: leitura da sessão efetiva sem RLS da tabela financials
-- =============================================================================
-- Sintoma: "Não foi possível carregar os meses disponíveis." + "Nenhum mês
-- disponível." no Ghost. O SELECT direto em public.financials falha (erro de
-- RLS/tenant), não só devolve zero linhas.
--
-- Correção:
--   1) Helpers de sessão não reentram em RLS (row_security = off).
--   2) RPCs SECURITY DEFINER listam meses e lançamentos do tenant efetivo
--      (header Ghost + igreja do alvo).
-- =============================================================================

alter function public.current_session_tenant_id() set row_security = off;
alter function public.current_session_profile_id() set row_security = off;
alter function public.current_real_session_profile_id() set row_security = off;
alter function public.resolve_valid_ghost_profile_id() set row_security = off;
alter function public.current_ghost_profile_id_from_header() set row_security = off;
alter function public.session_tenant_matches(uuid) set row_security = off;
alter function public.session_has_resource_access(text, text, text) set row_security = off;
alter function public.session_has_screen_access(text, text) set row_security = off;
alter function public.profile_has_access(uuid, text, text, text) set row_security = off;
alter function public.profile_primary_tenant_id(uuid) set row_security = off;
alter function public.profile_can_use_tenant(uuid, uuid) set row_security = off;
alter function public.profile_belongs_to_tenant(uuid, uuid) set row_security = off;

create or replace function public.session_can_view_member_financials()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    public.session_has_resource_access('table', 'financials', 'view')
    or public.session_has_screen_access('/financial', 'view')
    or public.session_has_screen_access('dashboard.card.financial', 'view')
    or public.session_has_screen_access('maintenance.card.financials', 'view');
$$;

create or replace function public.resolve_financials_session_tenant_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
  v_profile uuid;
begin
  v_tenant := public.current_session_tenant_id();
  if v_tenant is not null then
    return v_tenant;
  end if;

  v_profile := public.current_session_profile_id();
  if v_profile is null then
    return null;
  end if;

  return public.profile_primary_tenant_id(v_profile);
end;
$$;

create or replace function public.listar_meses_financeiros_sessao()
returns table (
  year integer,
  month integer,
  has_realized boolean,
  has_planned boolean
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
begin
  if not public.session_can_view_member_financials() then
    return;
  end if;

  v_tenant := public.resolve_financials_session_tenant_id();
  if v_tenant is null then
    return;
  end if;

  return query
  select
    extract(year from f.transaction_date)::integer as year,
    extract(month from f.transaction_date)::integer as month,
    bool_or(upper(trim(coalesce(f.budget_version, ''))) like '%REALIZ%') as has_realized,
    bool_or(upper(trim(coalesce(f.budget_version, ''))) like '%PLANEJ%') as has_planned
  from public.financials f
  where f.tenant_id = v_tenant
    and f.transaction_date is not null
    and (
      upper(trim(coalesce(f.budget_version, ''))) like '%REALIZ%'
      or upper(trim(coalesce(f.budget_version, ''))) like '%PLANEJ%'
    )
  group by 1, 2
  order by 1 desc, 2 desc;
end;
$$;

create or replace function public.listar_lancamentos_financeiros_ate(p_end date)
returns table (
  id uuid,
  transaction_date date,
  account text,
  amount numeric,
  ministry text,
  transaction_kind text,
  movement text,
  budget_version text,
  comments text,
  receipt_url text,
  receipt_urls jsonb
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
begin
  if p_end is null then
    return;
  end if;

  if not public.session_can_view_member_financials() then
    return;
  end if;

  v_tenant := public.resolve_financials_session_tenant_id();
  if v_tenant is null then
    return;
  end if;

  return query
  select
    f.id,
    f.transaction_date,
    f.account,
    f.amount,
    f.ministry,
    f.transaction_kind,
    f.movement,
    f.budget_version,
    f.comments,
    f.receipt_url,
    f.receipt_urls
  from public.financials f
  where f.tenant_id = v_tenant
    and f.transaction_date <= p_end
    and (
      upper(trim(coalesce(f.budget_version, ''))) like '%REALIZ%'
      or upper(trim(coalesce(f.budget_version, ''))) like '%PLANEJ%'
    )
  order by f.transaction_date asc;
end;
$$;

grant execute on function public.session_can_view_member_financials() to anon, authenticated;
grant execute on function public.resolve_financials_session_tenant_id() to anon, authenticated;
grant execute on function public.listar_meses_financeiros_sessao() to anon, authenticated;
grant execute on function public.listar_lancamentos_financeiros_ate(date) to anon, authenticated;

notify pgrst, 'reload schema';
