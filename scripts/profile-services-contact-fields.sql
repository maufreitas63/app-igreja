-- Página WEB e Instagram no cartão de serviço / vCard.
-- Aplica: npx supabase db query --linked -f scripts/profile-services-contact-fields.sql

alter table public.profile_services
  add column if not exists pagina_web text not null default '',
  add column if not exists instagram text not null default '';

comment on column public.profile_services.pagina_web is
  'URL da página web do prestador, incluída no cartão e no vCard.';
comment on column public.profile_services.instagram is
  'Usuário do Instagram (sem @), incluído no cartão e no vCard.';

create or replace function public.normalize_profile_service_url(p_url text)
returns text
language plpgsql
immutable
as $$
declare
  v text := trim(coalesce(p_url, ''));
begin
  if v = '' then
    return '';
  end if;
  if v ~* '^(javascript|data|vbscript):' then
    return '';
  end if;
  if v ~* '^https?://' then
    return left(v, 300);
  end if;
  if v ~* '^//' then
    return left('https:' || v, 300);
  end if;
  return left('https://' || ltrim(v, '/'), 300);
end;
$$;

create or replace function public.normalize_profile_service_instagram(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  v text := trim(coalesce(p_value, ''));
begin
  if v = '' then
    return '';
  end if;
  v := regexp_replace(v, '^https?://(www\.)?instagram\.com/', '', 'i');
  v := regexp_replace(v, '^@+', '');
  v := split_part(split_part(v, '/', 1), '?', 1);
  v := regexp_replace(v, '[^A-Za-z0-9._]', '', 'g');
  return left(v, 30);
end;
$$;

create or replace function public.get_my_profile_service()
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
  v_row public.profile_services%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  select * into v_profile
    from public.profiles p
   where p.id = v_me
     and p.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Perfil fora desta igreja.');
  end if;

  select * into v_row
    from public.profile_services s
   where s.tenant_id = v_tenant
     and s.profile_id = v_me;

  return jsonb_build_object(
    'success', true,
    'service', jsonb_build_object(
      'id', v_row.id,
      'profile_id', v_me,
      'full_name', v_profile.full_name,
      'email', v_profile.email,
      'titulo_servico', coalesce(v_row.titulo_servico, ''),
      'descricao_servico', coalesce(v_row.descricao_servico, ''),
      'categoria', coalesce(v_row.categoria, 'outros'),
      'status_ativo', coalesce(v_row.status_ativo, false),
      'telefone_contato', coalesce(
        nullif(public.normalize_profile_service_phone(v_row.telefone_contato), ''),
        public.normalize_profile_service_phone(v_profile.phone)
      ),
      'pagina_web', coalesce(v_row.pagina_web, ''),
      'instagram', coalesce(v_row.instagram, '')
    )
  );
end;
$$;

drop function if exists public.upsert_my_profile_service(text, text, text, boolean, text);

create or replace function public.upsert_my_profile_service(
  p_titulo_servico text,
  p_descricao_servico text,
  p_categoria text,
  p_status_ativo boolean,
  p_telefone_contato text,
  p_pagina_web text default '',
  p_instagram text default ''
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
  v_web text := public.normalize_profile_service_url(p_pagina_web);
  v_instagram text := public.normalize_profile_service_instagram(p_instagram);
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
    pagina_web,
    instagram,
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
    v_web,
    v_instagram,
    now()
  )
  on conflict (tenant_id, profile_id) do update
    set titulo_servico = excluded.titulo_servico,
        descricao_servico = excluded.descricao_servico,
        categoria = excluded.categoria,
        status_ativo = excluded.status_ativo,
        telefone_contato = excluded.telefone_contato,
        pagina_web = excluded.pagina_web,
        instagram = excluded.instagram,
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

drop function if exists public.list_profile_services_mural();

create function public.list_profile_services_mural()
returns table (
  id uuid,
  profile_id uuid,
  full_name text,
  email text,
  titulo_servico text,
  descricao_servico text,
  categoria text,
  telefone_contato text,
  pagina_web text,
  instagram text,
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
    coalesce(nullif(trim(s.pagina_web), ''), '') as pagina_web,
    coalesce(nullif(trim(s.instagram), ''), '') as instagram,
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
    coalesce(nullif(trim(s.pagina_web), ''), '') as pagina_web,
    coalesce(nullif(trim(s.instagram), ''), '') as instagram,
    p.selfie_url
    into v_rec
    from public.profile_services s
    join public.profiles p on p.id = s.profile_id
   where s.id = p_id
     and s.tenant_id = v_tenant
     and p.tenant_id = v_tenant
     and s.status_ativo = true
     and coalesce(p.is_active, true);

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
      'pagina_web', v_rec.pagina_web,
      'instagram', v_rec.instagram,
      'selfie_url', v_rec.selfie_url
    )
  );
end;
$$;

grant execute on function public.normalize_profile_service_url(text) to anon, authenticated, service_role;
grant execute on function public.normalize_profile_service_instagram(text) to anon, authenticated, service_role;
grant execute on function public.get_my_profile_service() to anon, authenticated, service_role;
grant execute on function public.upsert_my_profile_service(text, text, text, boolean, text, text, text) to anon, authenticated, service_role;
grant execute on function public.list_profile_services_mural() to anon, authenticated, service_role;
grant execute on function public.get_profile_service_mural(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
