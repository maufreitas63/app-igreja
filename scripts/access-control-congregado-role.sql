-- Papel Congregado (entre Membro e Responsável familiar).
-- Execute no SQL Editor do Supabase após access-control-schema.sql.

insert into public.access_roles (code, name, description, is_system)
values (
  'congregado',
  'Congregado',
  'Participante cadastrado com acesso básico; sem gerência familiar',
  true
)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

-- Grants iniciais (ajuste depois em Manutenção → Controle de Acesso → Papéis).
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/dashboard', true, false),
      ('screen', '/manage-profile', true, true),
      ('screen', '/pastoral', true, true),
      ('screen', '/pastoral-history', true, false),
      ('screen', '/lgpd', true, true),
      ('screen', 'dashboard.card.event_alt', true, false),
      ('screen', 'dashboard.card.qr', true, false),
      ('screen', 'dashboard.card.kids_teens', true, false),
      ('screen', 'dashboard.card.offerings', true, false),
      ('screen', 'dashboard.card.pastoral', true, false),
      ('screen', 'dashboard.card.birthdays', true, false),
      ('screen', 'dashboard.card.grouped_manage', true, false),
      ('table', 'profiles', true, true),
      ('table', 'pastoral_requests', true, true),
      ('column', 'profiles.full_name', true, true),
      ('column', 'profiles.phone', true, true),
      ('column', 'profiles.birth_date', true, true),
      ('column', 'profiles.email', true, true),
      ('column', 'profiles.cep', true, true),
      ('column', 'profiles.address_street', true, true),
      ('column', 'profiles.address_number', true, true),
      ('column', 'profiles.address_complement', true, true),
      ('column', 'profiles.address_neighborhood', true, true),
      ('column', 'profiles.address_city', true, true),
      ('column', 'profiles.address_state', true, true)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'congregado'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Ordem de exibição na UI admin: Membro → Congregado → Responsável familiar
-- access_role_display_order: script canônico em access-control-role-display-order.sql

create or replace function public.listar_access_roles_admin(p_actor_profile_id uuid)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  is_system boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  return query
  select
    ar.id,
    ar.code,
    ar.name,
    ar.description,
    ar.is_system
  from public.access_roles ar
  order by public.access_role_display_order(ar.code), ar.name asc;
end;
$$;

create or replace function public.listar_papeis_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  role_id uuid,
  role_code text,
  role_name text,
  assigned boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_profile_id) then
    raise exception 'Perfil não encontrado.';
  end if;

  return query
  select
    ar.id as role_id,
    ar.code as role_code,
    ar.name as role_name,
    exists (
      select 1
        from public.profile_access_roles par
       where par.profile_id = p_target_profile_id
         and par.role_id = ar.id
    ) as assigned
  from public.access_roles ar
  order by public.access_role_display_order(ar.code), ar.name asc;
end;
$$;

