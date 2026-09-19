-- Apoio Mútuo: exclusão da oferta + ACL da tela.
-- Aplica: npx supabase db query --linked -f scripts/profile-services-apoio-mutuo.sql

create or replace function public.session_can_view_apoio_mutuo()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return false;
  end if;
  if public.is_super_admin_profile(v_me) then
    return true;
  end if;
  return public.profile_has_access(v_me, 'screen', '/apoio-mutuo', 'view')
      or public.profile_has_access(v_me, 'screen', 'dashboard.card.apoio_mutuo', 'view');
end;
$$;

create or replace function public.delete_my_profile_service()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_deleted int := 0;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = v_me
       and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil fora desta igreja.');
  end if;

  delete from public.profile_services s
   where s.tenant_id = v_tenant
     and s.profile_id = v_me;

  get diagnostics v_deleted = row_count;

  if v_deleted <= 0 then
    return jsonb_build_object('success', true, 'message', 'Nenhuma oferta para excluir.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Oferta excluída. Ela não aparece mais no Apoio Mútuo.'
  );
end;
$$;

create or replace function public.list_profile_services_mural()
returns table (
  id uuid,
  profile_id uuid,
  full_name text,
  email text,
  titulo_servico text,
  descricao_servico text,
  categoria text,
  telefone_contato text,
  selfie_url text
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null or not public.session_can_view_apoio_mutuo() then
    return;
  end if;

  return query
  select
    s.id,
    s.profile_id,
    p.full_name,
    p.email,
    s.titulo_servico,
    s.descricao_servico,
    s.categoria,
    coalesce(
      nullif(public.normalize_profile_service_phone(s.telefone_contato), ''),
      public.normalize_profile_service_phone(p.phone)
    ) as telefone_contato,
    p.selfie_url
    from public.profile_services s
    join public.profiles p on p.id = s.profile_id
   where s.tenant_id = v_tenant
     and p.tenant_id = v_tenant
     and s.status_ativo = true
     and length(trim(s.titulo_servico)) >= 2
     and coalesce(p.is_active, true)
   order by s.titulo_servico asc, p.full_name asc;
end;
$$;

create or replace function public.get_profile_service_mural(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_rec record;
begin
  if v_me is null or not public.session_can_view_apoio_mutuo() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para o Apoio Mútuo.');
  end if;

  select
    s.id,
    s.profile_id,
    p.full_name,
    p.email,
    s.titulo_servico,
    s.descricao_servico,
    s.categoria,
    coalesce(
      nullif(public.normalize_profile_service_phone(s.telefone_contato), ''),
      public.normalize_profile_service_phone(p.phone)
    ) as telefone_contato,
    p.selfie_url
    into v_rec
    from public.profile_services s
    join public.profiles p on p.id = s.profile_id
   where s.id = p_id
     and s.tenant_id = v_tenant
     and p.tenant_id = v_tenant
     and s.status_ativo = true;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Serviço não encontrado nesta igreja.');
  end if;

  return jsonb_build_object(
    'success', true,
    'service', jsonb_build_object(
      'id', v_rec.id,
      'profile_id', v_rec.profile_id,
      'full_name', v_rec.full_name,
      'email', v_rec.email,
      'titulo_servico', v_rec.titulo_servico,
      'descricao_servico', v_rec.descricao_servico,
      'categoria', v_rec.categoria,
      'telefone_contato', v_rec.telefone_contato,
      'selfie_url', v_rec.selfie_url
    )
  );
end;
$$;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'dashboard.card.apoio_mutuo',
    'Apoio Mútuo',
    'Cartões de serviço oferecidos pelos membros desta igreja.',
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

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code in ('super_admin', 'member')
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key in ('dashboard.card.apoio_mutuo', '/apoio-mutuo')
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'member', 'congregado',
   'tesoureiro', 'events_admin', 'gestor_controle_acesso', 'family_acceptor'
 )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Mensagens de publicação passam a citar o Apoio Mútuo (função já existente).
create or replace function public.upsert_my_profile_service(
  p_titulo_servico text,
  p_descricao_servico text,
  p_categoria text,
  p_status_ativo boolean,
  p_telefone_contato text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_titulo text := trim(coalesce(p_titulo_servico, ''));
  v_descricao text := trim(coalesce(p_descricao_servico, ''));
  v_categoria text := lower(trim(coalesce(p_categoria, 'outros')));
  v_ativo boolean := coalesce(p_status_ativo, false);
  v_phone text := public.normalize_profile_service_phone(p_telefone_contato);
  v_id uuid;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = v_me
       and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil fora desta igreja.');
  end if;

  if not public.profile_service_categoria_ok(v_categoria) then
    v_categoria := 'outros';
  end if;

  if v_phone = '' then
    select public.normalize_profile_service_phone(p.phone)
      into v_phone
      from public.profiles p
     where p.id = v_me;
  end if;

  if v_ativo and length(v_titulo) < 2 then
    return jsonb_build_object(
      'success', false,
      'message', 'Informe o título do serviço para publicar no Apoio Mútuo.'
    );
  end if;

  if v_ativo and length(v_phone) < 10 then
    return jsonb_build_object(
      'success', false,
      'message', 'Informe o WhatsApp de contato com DDD para publicar no Apoio Mútuo.'
    );
  end if;

  insert into public.profile_services (
    tenant_id,
    profile_id,
    titulo_servico,
    descricao_servico,
    categoria,
    status_ativo,
    telefone_contato,
    updated_at
  )
  values (
    v_tenant,
    v_me,
    v_titulo,
    v_descricao,
    v_categoria,
    v_ativo,
    coalesce(v_phone, ''),
    now()
  )
  on conflict (tenant_id, profile_id) do update
    set titulo_servico = excluded.titulo_servico,
        descricao_servico = excluded.descricao_servico,
        categoria = excluded.categoria,
        status_ativo = excluded.status_ativo,
        telefone_contato = excluded.telefone_contato,
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'message', case
      when v_ativo then 'Serviço publicado no Apoio Mútuo desta igreja.'
      else 'Serviço salvo. Ele não aparece no Apoio Mútuo enquanto estiver inativo.'
    end,
    'id', v_id
  );
end;
$$;

grant execute on function public.session_can_view_apoio_mutuo() to anon, authenticated, service_role;
grant execute on function public.upsert_my_profile_service(text, text, text, boolean, text) to anon, authenticated, service_role;
grant execute on function public.delete_my_profile_service() to anon, authenticated, service_role;
grant execute on function public.list_profile_services_mural() to anon, authenticated, service_role;
grant execute on function public.get_profile_service_mural(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
