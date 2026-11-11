-- Ordenação estável (data, id) para paginar listar_lancamentos_financeiros_ate além de 1000 linhas.

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
  order by f.transaction_date asc, f.id asc;
end;
$$;

grant execute on function public.listar_lancamentos_financeiros_ate(date) to anon, authenticated;

notify pgrst, 'reload schema';
