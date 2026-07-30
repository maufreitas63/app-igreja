-- =============================================================================
-- Reset da Trilha de Discipulado (super_admin) — multi-tenant
-- =============================================================================
-- Permite reiniciar progresso/selos/alertas de um perfil na igreja da sessão.
-- Pré-requisitos: discipleship-trail-schema.sql + discipleship-trail-badges-alerts.sql
-- =============================================================================

create or replace function public.search_discipleship_reset_candidates(
  p_query text default '',
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_q text := lower(trim(coalesce(p_query, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if v_actor is null or not public.is_super_admin_profile(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.', 'items', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'profile_id', x.profile_id,
            'full_name', x.full_name,
            'phone', x.phone,
            'lessons_completed', x.lessons_completed,
            'has_trail_badge', x.has_trail_badge,
            'has_alert', x.has_alert
          )
          order by x.full_name
        )
        from (
          select
            p.id as profile_id,
            trim(p.full_name) as full_name,
            nullif(trim(coalesce(p.phone, '')), '') as phone,
            (
              select count(*)::int
                from public.user_discipleship_progress pr
               where pr.tenant_id = v_tenant
                 and pr.profile_id = p.id
                 and pr.status = 'completed'
            ) as lessons_completed,
            exists (
              select 1
                from public.user_discipleship_badges b
               where b.tenant_id = v_tenant
                 and b.profile_id = p.id
                 and b.badge_code = 'trail_complete'
            ) as has_trail_badge,
            exists (
              select 1
                from public.discipleship_pastoral_alerts a
               where a.tenant_id = v_tenant
                 and a.profile_id = p.id
            ) as has_alert
          from public.profiles p
          where p.tenant_id = v_tenant
            and p.full_name is not null
            and trim(p.full_name) <> ''
            and (
              v_q = ''
              or lower(trim(p.full_name)) like '%' || v_q || '%'
              or replace(coalesce(p.phone, ''), ' ', '') like '%' || replace(v_q, ' ', '') || '%'
            )
            and (
              exists (
                select 1
                  from public.user_discipleship_progress pr
                 where pr.tenant_id = v_tenant
                   and pr.profile_id = p.id
              )
              or exists (
                select 1
                  from public.user_discipleship_badges b
                 where b.tenant_id = v_tenant
                   and b.profile_id = p.id
              )
              or exists (
                select 1
                  from public.discipleship_pastoral_alerts a
                 where a.tenant_id = v_tenant
                   and a.profile_id = p.id
              )
              or v_q <> ''
            )
          order by trim(p.full_name)
          limit v_limit
        ) x
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.search_discipleship_reset_candidates(text, integer)
  to anon, authenticated;

create or replace function public.reset_discipleship_trail_for_profile(
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_name text;
  v_progress integer := 0;
  v_badges integer := 0;
  v_alerts integer := 0;
begin
  if v_actor is null or not public.is_super_admin_profile(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores podem resetar a Trilha.');
  end if;

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  select trim(p.full_name) into v_name
    from public.profiles p
   where p.id = p_profile_id
     and p.tenant_id = v_tenant;

  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado nesta igreja.');
  end if;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  delete from public.user_discipleship_progress
   where tenant_id = v_tenant
     and profile_id = p_profile_id;
  get diagnostics v_progress = row_count;

  delete from public.user_discipleship_badges
   where tenant_id = v_tenant
     and profile_id = p_profile_id;
  get diagnostics v_badges = row_count;

  delete from public.discipleship_pastoral_alerts
   where tenant_id = v_tenant
     and profile_id = p_profile_id;
  get diagnostics v_alerts = row_count;

  return jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'full_name', v_name,
    'deleted_progress', v_progress,
    'deleted_badges', v_badges,
    'deleted_alerts', v_alerts,
    'message', 'Trilha reiniciada para ' || v_name || '.'
  );
end;
$$;

grant execute on function public.reset_discipleship_trail_for_profile(uuid)
  to anon, authenticated;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  'maintenance.card.discipleship_reset',
  'Resetar Trilha',
  'Super admin reinicia o progresso da Trilha de um usuário nesta igreja',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.discipleship_reset'
 where r.code = 'super_admin'
   and not exists (
     select 1
       from public.access_grants g
      where g.role_id = r.id
        and g.resource_id = res.id
        and g.profile_id is null
   );

notify pgrst, 'reload schema';

select 'discipleship-trail-reset-admin: ok' as status;
