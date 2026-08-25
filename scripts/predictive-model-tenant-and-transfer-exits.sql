-- Modelo preditivo: isola a instância e conta saída por transferência no vínculo.
-- Aplica: npx supabase db query --linked -f scripts/predictive-model-tenant-and-transfer-exits.sql

create or replace function public.listar_datas_membresia_modelo_preditivo(
  p_actor_profile_id uuid
)
returns table (
  membership_date date,
  membership_out date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  perform public.assert_predictive_insights_actor(p_actor_profile_id);

  v_tenant := coalesce(
    public.current_session_tenant_id(),
    (select p.tenant_id from public.profiles p where p.id = p_actor_profile_id)
  );

  if v_tenant is null then
    raise exception 'Sessão sem igreja. Saia e entre novamente.';
  end if;

  return query
  select
    p.membership_date,
    coalesce(v.membership_out, case when p.tenant_id = v_tenant then p.membership_out else null end)
      as membership_out
    from public.profiles p
    left join public.profile_igreja_vinculos v
      on v.profile_id = p.id
     and v.tenant_id = v_tenant
   where v.profile_id is not null
      or p.tenant_id = v_tenant;
end;
$$;

create or replace function public.listar_receita_ordinaria_modelo_preditivo(
  p_actor_profile_id uuid,
  p_end_date date default current_date
)
returns table (
  id uuid,
  transaction_date date,
  account text,
  amount numeric,
  ministry text,
  transaction_kind text,
  movement text,
  budget_version text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  perform public.assert_predictive_insights_actor(p_actor_profile_id);

  v_tenant := coalesce(
    public.current_session_tenant_id(),
    (select p.tenant_id from public.profiles p where p.id = p_actor_profile_id)
  );

  if v_tenant is null then
    raise exception 'Sessão sem igreja. Saia e entre novamente.';
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
    f.budget_version
    from public.financials f
   where f.tenant_id = v_tenant
     and f.transaction_date <= coalesce(p_end_date, current_date)
     and upper(trim(coalesce(f.budget_version, ''))) like '%REALIZ%'
     and upper(translate(trim(coalesce(f.transaction_kind, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) in ('ENTRADAS', 'ENTRADA')
     and upper(translate(trim(coalesce(f.movement, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) like '%ORDIN%'
     and upper(translate(trim(coalesce(f.movement, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) not like '%EXTRAORDIN%'
     and (
       upper(translate(trim(coalesce(f.ministry, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) = 'OFERTAS'
       or upper(translate(trim(coalesce(f.ministry, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) like '%DIZIM%'
     )
   order by f.transaction_date asc;
end;
$$;

comment on function public.listar_datas_membresia_modelo_preditivo(uuid) is
  'Datas de entrada/saída da igreja da sessão. Saída por transferência usa profile_igreja_vinculos.membership_out.';

comment on function public.listar_receita_ordinaria_modelo_preditivo(uuid, date) is
  'Receita ordinária realizada (dízimos/ofertas) apenas do tenant da sessão.';

grant execute on function public.listar_datas_membresia_modelo_preditivo(uuid) to anon, authenticated;
grant execute on function public.listar_receita_ordinaria_modelo_preditivo(uuid, date) to anon, authenticated;

notify pgrst, 'reload schema';
