-- Modelo preditivo: arrecadação + expansão de membros.
-- Execute no SQL Editor do Supabase após access-control-pastoral-membership-out.sql
-- e financials-maintenance-rpc.sql.

insert into public.access_resources (resource_type, resource_key, label, description)
values (
  'screen',
  'maintenance.card.predictive_insights',
  'Manutenção: Modelo Preditivo',
  'Previsibilidade de arrecadação ordinária (dízimos/ofertas) e LTV de crescimento de membros'
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.predictive_insights'
 where r.code in ('tesoureiro', 'pastoral', 'super_admin')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

create or replace function public.assert_predictive_insights_actor(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if public.is_super_admin_profile(p_actor_profile_id) then
    return;
  end if;

  if public.profile_has_access(
    p_actor_profile_id,
    'screen',
    'maintenance.card.predictive_insights',
    'view'
  ) then
    return;
  end if;

  raise exception 'Sem permissão para visualizar o modelo preditivo.';
end;
$$;

drop function if exists public.listar_datas_membresia_modelo_preditivo(uuid);

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
begin
  perform public.assert_predictive_insights_actor(p_actor_profile_id);

  return query
  select p.membership_date, p.membership_out
    from public.profiles p
   where p.membership_date is not null
      or p.membership_out is not null;
end;
$$;

drop function if exists public.listar_receita_ordinaria_modelo_preditivo(uuid, date);

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
begin
  perform public.assert_predictive_insights_actor(p_actor_profile_id);

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
   where f.transaction_date <= coalesce(p_end_date, current_date)
     and upper(trim(coalesce(f.budget_version, ''))) like '%REALIZ%'
     and upper(trim(coalesce(f.transaction_kind, ''))) in ('ENTRADAS', 'ENTRADA')
     and upper(trim(coalesce(f.movement, ''))) like '%ORDIN%'
     and upper(trim(coalesce(f.movement, ''))) not like '%EXTRAORDIN%'
     and (
       upper(trim(coalesce(f.ministry, ''))) = 'OFERTAS'
       or upper(trim(coalesce(f.ministry, ''))) like '%DIZIM%'
     )
   order by f.transaction_date asc;
end;
$$;

grant execute on function public.assert_predictive_insights_actor(uuid) to anon, authenticated;
grant execute on function public.listar_datas_membresia_modelo_preditivo(uuid) to anon, authenticated;
grant execute on function public.listar_receita_ordinaria_modelo_preditivo(uuid, date) to anon, authenticated;

notify pgrst, 'reload schema';
