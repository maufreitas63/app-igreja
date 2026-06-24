-- Painel Relatórios no dashboard de manutenção.
-- Execute no SQL Editor do Supabase após access-control-schema.sql.

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  'maintenance.card.relatorios',
  'Manutenção — Relatórios',
  'Catálogo analítico: membros, finanças, território, eventos, pastoral, voluntários e adoção digital.'
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
   and res.resource_key = 'maintenance.card.relatorios'
 where r.code in ('super_admin', 'events_admin', 'pastoral', 'tesoureiro')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

create or replace function public.assert_maintenance_reports_actor(p_actor_profile_id uuid)
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
    'maintenance.card.relatorios',
    'view'
  ) then
    return;
  end if;

  raise exception 'Sem permissão para gerar relatórios de manutenção.';
end;
$$;

create or replace function public.assert_maintenance_reports_health_actor(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_maintenance_reports_actor(p_actor_profile_id);

  if public.is_super_admin_profile(p_actor_profile_id) then
    return;
  end if;

  if public.profile_has_access(p_actor_profile_id, 'screen', 'maintenance.card.pastoral_care', 'view')
     or public.profile_has_access(p_actor_profile_id, 'screen', 'maintenance.card.profile_cadastro', 'view') then
    return;
  end if;

  raise exception 'Relatório de saúde infantil exige liderança pastoral ou administrador (LGPD).';
end;
$$;

grant execute on function public.assert_maintenance_reports_actor(uuid) to anon, authenticated;
grant execute on function public.assert_maintenance_reports_health_actor(uuid) to anon, authenticated;
