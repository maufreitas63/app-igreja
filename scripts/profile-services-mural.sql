-- Cartão de serviço no Mural de Oportunidades (tenant = igrejas).
-- Cadastro e listagem só da instância da sessão. Nenhum prestador de outra igreja.
-- Aplica: npx supabase db query --linked -f scripts/profile-services-mural.sql

create table if not exists public.profile_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  titulo_servico text not null default '',
  descricao_servico text not null default '',
  categoria text not null default 'outros'
    check (categoria in (
      'beleza',
      'saude',
      'educacao',
      'manutencao',
      'alimentacao',
      'tecnologia',
      'juridico',
      'artes',
      'transporte',
      'outros'
    )),
  status_ativo boolean not null default false,
  telefone_contato text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_services_tenant_profile_unique unique (tenant_id, profile_id),
  constraint profile_services_titulo_when_active_check
    check (status_ativo = false or length(trim(titulo_servico)) >= 2)
);

comment on table public.profile_services is
  'Serviço oferecido pelo membro no mural da própria igreja. Isolado por tenant_id.';
comment on column public.profile_services.titulo_servico is
  'Título do serviço no cartão digital.';
comment on column public.profile_services.descricao_servico is
  'Descrição curta do serviço.';
comment on column public.profile_services.categoria is
  'Categoria do serviço no mural local.';
comment on column public.profile_services.status_ativo is
  'Se verdadeiro, o cartão entra no mural da instância.';
comment on column public.profile_services.telefone_contato is
  'Telefone/WhatsApp de contato do prestador.';

create index if not exists profile_services_tenant_active_idx
  on public.profile_services (tenant_id, categoria, created_at desc)
  where status_ativo = true;

alter table public.profile_services enable row level security;

drop policy if exists profile_services_deny_direct on public.profile_services;
create policy profile_services_deny_direct
  on public.profile_services for all using (false) with check (false);

create or replace function public.profile_service_categoria_ok(p_categoria text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_categoria, ''))) in (
    'beleza',
    'saude',
    'educacao',
    'manutencao',
    'alimentacao',
    'tecnologia',
    'juridico',
    'artes',
    'transporte',
    'outros'
  );
$$;

create or replace function public.normalize_profile_service_phone(p_phone text)
returns text
language sql
immutable
as $$
  select left(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 15);
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
      )
    )
  );
end;
$$;

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
      'message', 'Informe o título do serviço para publicar no mural.'
    );
  end if;

  if v_ativo and length(v_phone) < 10 then
    return jsonb_build_object(
      'success', false,
      'message', 'Informe o WhatsApp de contato com DDD para publicar no mural.'
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
      when v_ativo then 'Serviço publicado no mural desta igreja.'
      else 'Serviço salvo. Ele não aparece no mural enquanto estiver inativo.'
    end,
    'id', v_id
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
  if v_me is null or not public.session_can_view_volunteer_mural() then
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
  if v_me is null or not public.session_can_view_volunteer_mural() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para o mural.');
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

grant execute on function public.profile_service_categoria_ok(text) to anon, authenticated, service_role;
grant execute on function public.normalize_profile_service_phone(text) to anon, authenticated, service_role;
grant execute on function public.get_my_profile_service() to anon, authenticated, service_role;
grant execute on function public.upsert_my_profile_service(text, text, text, boolean, text) to anon, authenticated, service_role;
grant execute on function public.list_profile_services_mural() to anon, authenticated, service_role;
grant execute on function public.get_profile_service_mural(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
