-- =============================================================================
-- Mudança de Papéis: lista sem timeout na IBS
-- =============================================================================
-- Sintoma: tela vazia + "Não foi possível carregar a lista de perfis."
-- Causa: listar_perfis_mudanca_papel_pastoral chama por linha
--   resolve_effective_membership_dates_for_profile (que ainda resolve papel,
--   guardian em members e directory_person_matches_member). Com ~500
--   cadastros a RPC passa de 20s e o cliente aborta.
--
-- Não execute o script antigo access-control-pastoral-role-change-fix-protected-list.sql:
-- ele recria a lista sem colunas de membresia/transferência.
-- =============================================================================

create or replace function public.listar_perfis_mudanca_papel_pastoral(
  p_actor_profile_id uuid,
  p_limit integer default 5000
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text,
  membership_date date,
  membership_out date,
  own_membership_date date,
  own_membership_out date,
  family_id text,
  membership_inherited boolean,
  inherited_from_name text,
  current_role_code text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
  v_limit integer;
begin
  v_tenant := public.require_session_tenant_id();
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  v_limit := greatest(1, least(coalesce(p_limit, 5000), 5000));

  return query
  with transferred as (
    select
      v.profile_id,
      coalesce(
        v.membership_out,
        (v.transferred_at at time zone 'America/Sao_Paulo')::date
      ) as session_out
    from public.profile_igreja_vinculos v
    where v.tenant_id = v_tenant
      and (
        coalesce(v.membership_status, '') = 'Transferido'
        or v.transferred_to_tenant_id is not null
        or v.membership_out is not null
      )
  ),
  origin_family as (
    select distinct on (tp.profile_id)
      tp.profile_id,
      upper(nullif(trim(tp.origin_family_id), '')) as family_id,
      tp.origin_roles
    from public.igreja_transfer_people tp
    join public.igreja_transfer_requests r on r.id = tp.request_id
    where r.origin_tenant_id = v_tenant
      and r.status = 'completed'
    order by tp.profile_id, r.decided_at desc nulls last, r.created_at desc
  ),
  basic_roles as (
    select
      par.profile_id,
      case
        when bool_or(ar.code = 'member') then 'member'
        when bool_or(ar.code = 'congregado') then 'congregado'
        else 'visitante'
      end as code
    from public.profile_access_roles par
    join public.access_roles ar on ar.id = par.role_id
    where ar.code in ('member', 'congregado')
    group by par.profile_id
  ),
  family_guardians as (
    select distinct on (upper(nullif(trim(gp.family_id), '')))
      upper(nullif(trim(gp.family_id), '')) as family_id,
      gp.id as guardian_id,
      gp.full_name as guardian_name,
      gp.membership_date,
      gp.membership_out
    from public.profiles gp
    join basic_roles br on br.profile_id = gp.id and br.code = 'member'
    where gp.tenant_id = v_tenant
      and nullif(trim(gp.family_id), '') is not null
    order by upper(nullif(trim(gp.family_id), '')), gp.full_name
  )
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)'),
    coalesce(p.phone, ''),
    coalesce(ofam.family_id, nullif(trim(p.codigo_membro), ''), ''),
    case
      when t.session_out is not null then p.membership_date
      when coalesce(br.code, 'visitante') = 'congregado'
        and g.guardian_id is not null
        and g.guardian_id <> p.id
        then g.membership_date
      else p.membership_date
    end,
    coalesce(
      t.session_out,
      case
        when coalesce(br.code, 'visitante') = 'congregado'
          and g.guardian_id is not null
          and g.guardian_id <> p.id
          then g.membership_out
        else p.membership_out
      end
    ),
    p.membership_date,
    coalesce(t.session_out, case when p.tenant_id = v_tenant then p.membership_out end),
    coalesce(ofam.family_id, nullif(trim(p.family_id), ''), ''),
    case
      when t.session_out is not null then false
      when coalesce(br.code, 'visitante') = 'congregado'
        and g.guardian_id is not null
        and g.guardian_id <> p.id
        then true
      else false
    end,
    case
      when t.session_out is not null then ''
      when coalesce(br.code, 'visitante') = 'congregado'
        and g.guardian_id is not null
        and g.guardian_id <> p.id
        then coalesce(nullif(trim(g.guardian_name), ''), '')
      else ''
    end,
    case
      when t.profile_id is not null then
        case
          when exists (
            select 1
              from jsonb_array_elements(coalesce(ofam.origin_roles, '[]'::jsonb)) elem
             where elem->>'code' = 'member'
          ) then 'member'
          when exists (
            select 1
              from jsonb_array_elements(coalesce(ofam.origin_roles, '[]'::jsonb)) elem
             where elem->>'code' = 'congregado'
          ) then 'congregado'
          else 'member'
        end
      else coalesce(br.code, 'visitante')
    end
  from public.profiles p
  left join transferred t on t.profile_id = p.id
  left join origin_family ofam on ofam.profile_id = p.id
  left join basic_roles br on br.profile_id = p.id
  left join family_guardians g
    on g.family_id = upper(nullif(trim(p.family_id), ''))
  where (p.tenant_id = v_tenant or t.profile_id is not null)
    and coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), ''),
      ofam.family_id
    ) is not null
  order by p.full_name asc
  limit v_limit;
end;
$$;

grant execute on function public.listar_perfis_mudanca_papel_pastoral(uuid, integer)
  to anon, authenticated;

notify pgrst, 'reload schema';
