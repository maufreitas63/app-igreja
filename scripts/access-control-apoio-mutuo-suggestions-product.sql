-- Apoio Mútuo e Sugestões: ACL do menu/produto respeita Controle de Acesso.
-- Execute: npx supabase db query --linked -f scripts/access-control-apoio-mutuo-suggestions-product.sql

-- ---------------------------------------------------------------------------
-- Apoio Mútuo: listagem exige grant da tela (ou do card) — não basta estar na igreja.
-- ---------------------------------------------------------------------------

create or replace function public.session_can_view_apoio_mutuo()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
begin
  if v_me is null or v_tenant is null then
    return false;
  end if;

  if public.is_super_admin_profile(v_me) then
    return true;
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = v_me
       and p.tenant_id = v_tenant
  ) then
    return false;
  end if;

  return public.session_has_resource_access('screen', '/apoio-mutuo', 'view')
      or public.session_has_resource_access('screen', 'dashboard.card.apoio_mutuo', 'view');
end;
$$;

-- ---------------------------------------------------------------------------
-- Sugestões: recurso do produto principal (azul) além do painel de manutenção.
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    '/suggestions-improvements',
    'Sugestões',
    'Menu do membro: registrar sugestões, dúvidas, comentários e incidentes.',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

-- Quem já tinha o painel de manutenção continua enxergando a tela do membro.
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = '/suggestions-improvements'
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'member', 'congregado',
   'visitantes', 'tesoureiro', 'events_admin', 'gestor_controle_acesso',
   'family_acceptor', 'secretaria'
 )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      updated_at = now();

-- Garante os dois recursos de Apoio Mútuo ativos e com rótulos claros no produto.
insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'dashboard.card.apoio_mutuo',
    'Apoio Mútuo',
    'Menu do membro: vitrine de serviços oferecidos nesta igreja.',
    true
  ),
  (
    'screen',
    '/apoio-mutuo',
    'Tela — Apoio Mútuo',
    'Listagem dos cartões de serviço da instância.',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

grant execute on function public.session_can_view_apoio_mutuo() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
