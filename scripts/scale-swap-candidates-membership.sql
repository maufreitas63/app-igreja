-- list_scale_swap_candidates usava profiles.status (coluna inexistente).
-- Ativo no app = membership_out IS NULL. Nome do substituto usa scale_swap_names_match.

create or replace function public.list_scale_swap_candidates(p_escala_log_id uuid)
returns table (
  profile_id uuid,
  volunteer_id uuid,
  volunteer_name text,
  phone text,
  already_scheduled boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_log public.escalas_log%rowtype;
  v_allow boolean;
  v_my_vol uuid;
begin
  if v_me is null or not public.scale_swap_can_member() then
    return;
  end if;

  select * into v_log
    from public.escalas_log el
   where el.id = p_escala_log_id
     and el.tenant_id = v_tenant;

  if not found then
    return;
  end if;

  select coalesce(te.allow_swap, true) into v_allow
    from public.tipos_escala te
   where te.id = v_log.tipo_escala_id
     and te.tenant_id = v_tenant;

  if v_allow is not true then
    return;
  end if;

  v_my_vol := public.scale_swap_volunteer_id_for_profile(v_tenant, v_me, v_log.tipo_escala_id);
  if v_my_vol is null or v_my_vol is distinct from v_log.voluntario_id then
    if not public.scale_swap_can_lead() then
      return;
    end if;
  end if;

  return query
  select
    p.id,
    ve.id,
    ve.nome,
    p.phone,
    exists (
      select 1
        from public.escalas_log busy
       where busy.tenant_id = v_tenant
         and busy.data_servico = v_log.data_servico
         and busy.voluntario_id = ve.id
    ) as already_scheduled
    from public.voluntarios_escala ve
    join public.profiles p
      on p.tenant_id = v_tenant
     and p.membership_out is null
     and public.scale_swap_names_match(p.full_name, ve.nome)
   where ve.tenant_id = v_tenant
     and ve.tipo_escala_id = v_log.tipo_escala_id
     and ve.is_ativo is true
     and ve.id is distinct from v_log.voluntario_id
     and p.id is distinct from v_me
     -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
     and public.profile_visible_to_access_actor(v_me, p.id)
   order by ve.ordem_sequencial, ve.nome;
end;
$$;

grant execute on function public.list_scale_swap_candidates(uuid) to anon, authenticated, service_role;
