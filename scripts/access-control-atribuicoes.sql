-- Atribuições: equipe pastoral e Super Administrador ligam/desligam papéis operacionais.
-- Exclui visitante, membro, congregado, responsável familiar e Super Administrador.
-- Execute: npx supabase db query --linked -f scripts/access-control-atribuicoes.sql

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  '/atribuicoes',
  'Atribuições',
  'Pastoral e Super Administrador atribuem papéis operacionais da instância.',
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
   and res.resource_key = '/atribuicoes'
 where r.code in ('pastoral', 'super_admin')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = true,
      updated_at = now();

delete from public.access_grants g
 using public.access_resources res, public.access_roles r
 where g.resource_id = res.id
   and g.role_id = r.id
   and res.resource_type = 'screen'
   and res.resource_key = '/atribuicoes'
   and r.code not in ('pastoral', 'super_admin');

create or replace function public.atribuicoes_excluded_role_codes()
returns text[]
language sql
immutable
as $$
  select array[
    'visitante',
    'visitantes',
    'member',
    'congregado',
    'family_acceptor',
    'membro',
    'super_admin'
  ];
$$;

create or replace function public.assert_atribuicoes_actor(p_actor_profile_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session uuid := public.current_session_profile_id();
  v_actor uuid := coalesce(p_actor_profile_id, v_session);
begin
  if v_session is null then
    raise exception 'Sessão inválida.';
  end if;

  if v_actor is distinct from v_session then
    raise exception 'Sessão inválida.';
  end if;

  if public.is_super_admin_profile(v_actor) then
    return v_actor;
  end if;

  if public.profile_has_role_code(v_actor, 'pastoral') then
    return v_actor;
  end if;

  raise exception 'Apenas a Equipe Pastoral e o Super Administrador acessam Atribuições.';
end;
$$;

create or replace function public.session_can_access_atribuicoes()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_atribuicoes_actor(public.current_session_profile_id());
  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function public.listar_papeis_atribuicoes(p_actor_profile_id uuid)
returns table (
  code text,
  name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_atribuicoes_actor(p_actor_profile_id);

  return query
  select ar.code, ar.name
    from public.access_roles ar
   where ar.code <> all (public.atribuicoes_excluded_role_codes())
   order by public.access_role_display_order(ar.code), ar.name;
end;
$$;

create or replace function public.listar_perfis_atribuicoes(
  p_actor_profile_id uuid,
  p_role_code text,
  p_query text default null,
  p_offset integer default 0,
  p_limit integer default 40
)
returns table (
  id uuid,
  full_name text,
  assigned boolean
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
  v_role text := lower(btrim(coalesce(p_role_code, '')));
  v_q text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 80));
begin
  perform public.assert_atribuicoes_actor(p_actor_profile_id);
  v_tenant := public.require_session_tenant_id();

  if v_role = '' or v_role = any (public.atribuicoes_excluded_role_codes()) then
    raise exception 'Papel inválido para atribuição.';
  end if;

  if not exists (select 1 from public.access_roles ar where ar.code = v_role) then
    raise exception 'Papel não encontrado.';
  end if;

  return query
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), '(sem nome)'),
    exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = p.id
         and ar.code = v_role
    )
  from public.profiles p
 where p.tenant_id = v_tenant
   -- Super Admin entra na lista pelos outros papéis; o papel super_admin não é oferecido nesta tela.
   and coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), '')) is not null
   and (
     v_q is null
     or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
   )
 order by p.full_name, p.id
 offset v_offset
 limit v_limit + 1;
end;
$$;

create or replace function public.definir_papel_atribuicao(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_role_code text,
  p_assigned boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_role text := lower(btrim(coalesce(p_role_code, '')));
  v_role_id uuid;
begin
  v_actor := public.assert_atribuicoes_actor(p_actor_profile_id);
  v_tenant := public.require_session_tenant_id();

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_role = '' or v_role = any (public.atribuicoes_excluded_role_codes()) then
    return jsonb_build_object('success', false, 'message', 'Este papel não pode ser atribuído aqui.');
  end if;

  -- Proteção aplicada: o papel Super Administrador não é atribuído nem removido nesta tela.
  if v_role = 'super_admin' then
    return jsonb_build_object('success', false, 'message', 'O Super Administrador não é gerenciado nesta tela.');
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = p_target_profile_id
       and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil fora desta igreja.');
  end if;

  select ar.id into v_role_id
    from public.access_roles ar
   where ar.code = v_role;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  if coalesce(p_assigned, false) then
    insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id)
    values (p_target_profile_id, v_role_id, v_actor)
    on conflict (profile_id, role_id) do nothing;

    return jsonb_build_object('success', true, 'message', 'Papel atribuído.', 'assigned', true);
  end if;

  delete from public.profile_access_roles
   where profile_id = p_target_profile_id
     and role_id = v_role_id;

  return jsonb_build_object('success', true, 'message', 'Papel removido.', 'assigned', false);
end;
$$;

grant execute on function public.atribuicoes_excluded_role_codes() to anon, authenticated;
grant execute on function public.assert_atribuicoes_actor(uuid) to anon, authenticated;
grant execute on function public.session_can_access_atribuicoes() to anon, authenticated;
grant execute on function public.listar_papeis_atribuicoes(uuid) to anon, authenticated;
grant execute on function public.listar_perfis_atribuicoes(uuid, text, text, integer, integer) to anon, authenticated;
grant execute on function public.definir_papel_atribuicao(uuid, uuid, text, boolean) to anon, authenticated;

do $$
declare
  v_id uuid;
  v_roles text[] := array['pastoral', 'super_admin'];
begin
  select id into v_id
    from public.knowledge_articles
   where tenant_id is null
     and lower(slug) = 'atribuicoes';

  if v_id is null then
    insert into public.knowledge_articles (
      slug, title, question, body, route_key, tenant_id, is_published, sort_order
    )
    values (
      'atribuicoes',
      'Atribuições',
      'Como ligo um papel operacional a várias pessoas de uma vez?',
      $body$## Quem acessa
Somente Equipe Pastoral e Super Administrador.

## Papel
Escolha o papel operacional. Visitante, membro, congregado, responsável familiar e Super Administrador ficam fora do seletor.

## Lista
A busca filtra pelo nome. Quem também é Super Administrador aparece pelos outros papéis (Secretaria, Tesoureiro etc.), nunca como Super Administrador. Sim indica quem já tem o papel escolhido; o toque grava na hora.$body$,
      '/atribuicoes',
      null,
      true,
      210
    )
    returning id into v_id;
  else
    update public.knowledge_articles
       set title = 'Atribuições',
           question = 'Como ligo um papel operacional a várias pessoas de uma vez?',
           body = $body$## Quem acessa
Somente Equipe Pastoral e Super Administrador.

## Papel
Escolha o papel operacional. Visitante, membro, congregado, responsável familiar e Super Administrador ficam fora do seletor.

## Lista
A busca filtra pelo nome. Quem também é Super Administrador aparece pelos outros papéis (Secretaria, Tesoureiro etc.), nunca como Super Administrador. Sim indica quem já tem o papel escolhido; o toque grava na hora.$body$,
           route_key = '/atribuicoes',
           is_published = true,
           sort_order = 210,
           updated_at = now()
     where id = v_id;
  end if;

  delete from public.knowledge_article_roles where article_id = v_id;
  insert into public.knowledge_article_roles (article_id, role_code)
  select v_id, code from unnest(v_roles) as code;
end;
$$;

notify pgrst, 'reload schema';
