-- Auditoria crítica 1–4: fecha RPC anônima de conciliação, IDOR só no cliente
-- (este arquivo), RLS deny-direct em slots pastorais e notify de oportunidades.
-- Contratos das RPCs de tela (list/upsert/book) permanecem iguais.
-- Aplica: npx supabase db query --linked -f scripts/audit-critical-1-4-lockdown.sql

-- ---------------------------------------------------------------------------
-- 1) reconcile_campaign_deposits — sessão/tenant ou papel de cron; sem anon
-- ---------------------------------------------------------------------------

create or replace function public.reconcile_campaign_deposits(p_tenant_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
  v_session_tenant uuid := public.current_session_tenant_id();
  v_session_profile uuid := public.current_session_profile_id();
  v_privileged boolean := (session_user in ('postgres', 'supabase_admin'));
  v_linked int := 0;
  v_count int := 0;
  v_campaign record;
  v_loop_tenant uuid;
begin
  if v_privileged then
    v_tenant := coalesce(p_tenant_id, v_session_tenant);
  else
    if v_session_profile is null or v_session_tenant is null then
      raise exception 'Sessão inválida.';
    end if;
    -- PostgREST nunca concilia outra igreja nem todas as igrejas.
    v_tenant := v_session_tenant;
  end if;

  if v_tenant is null then
    if not v_privileged then
      raise exception 'Sessão inválida.';
    end if;

    for v_loop_tenant in
      select distinct tenant_id from public.campaign_projects
    loop
      v_linked := v_linked
        + coalesce((public.reconcile_campaign_deposits(v_loop_tenant) ->> 'linked')::int, 0);
    end loop;

    return jsonb_build_object('success', true, 'linked', v_linked);
  end if;

  for v_campaign in
    select *
      from public.campaign_projects c
     where c.tenant_id = v_tenant
       and c.status in ('ativo', 'concluido')
  loop
    update public.financials f
       set campaign_project_id = v_campaign.id,
           ministry = 'CAMPANHAS',
           movement = 'EXTRAORDINÁRIO',
           comments = case
             when coalesce(f.comments, '') ilike '%' || v_campaign.titulo || '%' then f.comments
             when coalesce(trim(f.comments), '') = '' then 'Campanha: ' || v_campaign.titulo
             else trim(f.comments) || ' | Campanha: ' || v_campaign.titulo
           end
     where f.tenant_id = v_tenant
       and f.campaign_project_id is null
       and upper(trim(f.budget_version)) like '%REALIZ%'
       and upper(trim(f.transaction_kind)) like '%ENTRAD%'
       and f.transaction_date >= v_campaign.data_inicio
       and (v_campaign.data_fim is null or f.transaction_date <= v_campaign.data_fim)
       and public.campaign_cents_suffix(f.amount) = round(v_campaign.centavos_referencia * 100)::integer;

    get diagnostics v_count = row_count;
    v_linked := v_linked + v_count;

    perform public.refresh_campaign_project_totals(v_campaign.id);
    perform public.dispatch_campaign_milestones(v_campaign.id);
  end loop;

  return jsonb_build_object('success', true, 'linked', v_linked);
end;
$$;

revoke all on function public.reconcile_campaign_deposits(uuid) from public;
revoke all on function public.reconcile_campaign_deposits(uuid) from anon;
grant execute on function public.reconcile_campaign_deposits(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) pastoral_slots / notices — deny-direct (acesso só via RPC DEFINER)
-- ---------------------------------------------------------------------------

drop policy if exists pastoral_slots_tenant_all on public.pastoral_slots;
drop policy if exists pastoral_slots_deny_direct on public.pastoral_slots;
create policy pastoral_slots_deny_direct
  on public.pastoral_slots for all using (false) with check (false);

drop policy if exists pastoral_slot_notices_tenant_all on public.pastoral_slot_notices;
drop policy if exists pastoral_slot_notices_deny_direct on public.pastoral_slot_notices;
create policy pastoral_slot_notices_deny_direct
  on public.pastoral_slot_notices for all using (false) with check (false);

alter function public.list_available_pastoral_slots(uuid, timestamptz, timestamptz)
  set row_security = off;
alter function public.list_my_pastoral_appointments()
  set row_security = off;
alter function public.list_my_pastoral_agenda(timestamptz, timestamptz)
  set row_security = off;
alter function public.list_my_pastoral_slot_notices()
  set row_security = off;

-- ---------------------------------------------------------------------------
-- 4) volunteer_opportunity_notify_matches — ACL + tenant; sem EXECUTE público
-- ---------------------------------------------------------------------------

create or replace function public.volunteer_opportunity_notify_matches(p_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_opp public.volunteer_opportunities%rowtype;
  v_type_name text;
  v_privileged boolean := (session_user in ('postgres', 'supabase_admin'));
begin
  select * into v_opp
    from public.volunteer_opportunities
   where id = p_opportunity_id;

  if not found or v_opp.status is distinct from 'aberta' then
    return;
  end if;

  if not v_privileged then
    if public.current_session_profile_id() is null
       or not public.session_can_manage_volunteer_mural()
       or v_opp.tenant_id is distinct from public.current_session_tenant_id()
    then
      raise exception 'Sem permissão.';
    end if;
  end if;

  select te.nome into v_type_name
    from public.tipos_escala te
   where te.id = v_opp.tipo_escala_id;

  insert into public.volunteer_opportunity_notices (tenant_id, profile_id, opportunity_id, title, body)
  select
    v_opp.tenant_id,
    r.profile_id,
    v_opp.id,
    'Nova oportunidade aberta',
    'Há uma vaga em '
      || coalesce(v_type_name, 'um ministério')
      || ' alinhada ao seu perfil ministerial: '
      || v_opp.titulo || '.'
    from public.ministerial_resultados r
   where r.tenant_id = v_opp.tenant_id
     and r.perfil_vencedor = any(public.volunteer_gifts_normalized(v_opp.required_gifts))
     and not exists (
       select 1
         from public.volunteer_opportunity_notices n
        where n.opportunity_id = v_opp.id
          and n.profile_id = r.profile_id
     );
end;
$$;

revoke all on function public.volunteer_opportunity_notify_matches(uuid) from public;
revoke all on function public.volunteer_opportunity_notify_matches(uuid) from anon;
revoke all on function public.volunteer_opportunity_notify_matches(uuid) from authenticated;
grant execute on function public.volunteer_opportunity_notify_matches(uuid) to service_role;

notify pgrst, 'reload schema';
