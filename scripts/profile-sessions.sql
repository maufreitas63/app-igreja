-- Fase 2: sessão assinada server-side (resolve spoofing de x-profile-id).
-- Execute no SQL Editor do Supabase APÓS:
--   1. access-control-table-rls.sql
--   2. access-control-security-hardening.sql
--   3. verificar-login.sql (versão anterior)
--
-- O app passa a enviar x-session-token (emitido no login/cadastro inicial).
-- x-profile-id permanece como fallback legado até o usuário entrar novamente.

-- ---------------------------------------------------------------------------
-- Tabela de sessões
-- ---------------------------------------------------------------------------

create table if not exists public.profile_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profile_sessions_profile_id_idx
  on public.profile_sessions (profile_id);

create index if not exists profile_sessions_active_token_idx
  on public.profile_sessions (token)
  where revoked_at is null;

alter table public.profile_sessions enable row level security;

-- Sem policies: acesso apenas via funções security definer.

-- ---------------------------------------------------------------------------
-- Emissão / validação / revogação
-- ---------------------------------------------------------------------------

create or replace function public.issue_profile_session(
  p_profile_id uuid,
  p_ttl interval default interval '30 days'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_profile_id) then
    raise exception 'Perfil não encontrado.';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.profile_sessions (profile_id, token, expires_at)
  values (p_profile_id, v_token, now() + coalesce(p_ttl, interval '30 days'));

  return v_token;
end;
$$;

create or replace function public.resolve_profile_session_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ps.profile_id
    from public.profile_sessions ps
   where ps.token = nullif(trim(coalesce(p_token, '')), '')
     and ps.revoked_at is null
     and ps.expires_at > now()
   limit 1;
$$;

create or replace function public.revoke_profile_session(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.profile_sessions ps
     set revoked_at = now()
   where ps.token = nullif(trim(coalesce(p_token, '')), '')
     and ps.revoked_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sessão atual: token tem prioridade; header legado só sem token
-- ---------------------------------------------------------------------------

create or replace function public.current_session_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers text;
  v_token text;
  v_raw text;
  v_profile_id uuid;
begin
  begin
    v_headers := current_setting('request.headers', true);
  exception
    when others then
      return null;
  end;

  if v_headers is null or v_headers = '' then
    return null;
  end if;

  v_token := nullif(trim(coalesce((v_headers::json ->> 'x-session-token'), '')), '');

  if v_token is not null then
    v_profile_id := public.resolve_profile_session_token(v_token);

    if v_profile_id is not null then
      return v_profile_id;
    end if;

    -- Token inválido/expirado: não aceitar x-profile-id (anti-spoof).
    return null;
  end if;

  v_raw := nullif(trim(coalesce((v_headers::json ->> 'x-profile-id'), '')), '');

  if v_raw is null then
    return null;
  end if;

  begin
    return v_raw::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Login: emite session_token junto com o perfil
-- ---------------------------------------------------------------------------

drop function if exists public.verificar_login(text, text);

create or replace function public.verificar_login(
  p_phone text,
  p_password text
)
returns table (
  id uuid,
  phone text,
  full_name text,
  birth_date date,
  lgpd_accepted boolean,
  cpf text,
  email text,
  cep text,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_city text,
  address_state text,
  session_token text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_password text;
begin
  v_password := nullif(trim(coalesce(p_password, '')), '');

  if v_password is null or v_password !~ '^[0-9]{4}$' then
    return;
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return;
  end if;

  return query
  select
    p.id,
    p.phone,
    p.full_name,
    p.birth_date,
    p.lgpd_accepted,
    p.cpf,
    p.email,
    p.cep,
    p.address_street,
    p.address_number,
    p.address_neighborhood,
    p.address_city,
    p.address_state,
    public.issue_profile_session(p.id) as session_token
  from public.profiles p
  where p.id = v_profile_id
    and p.access_pin is not null
    and p.access_pin = v_password;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cadastro inicial: emite session_token ao concluir
-- ---------------------------------------------------------------------------

create or replace function public.complete_initial_profile_registration(
  p_profile_id uuid,
  p_full_name text,
  p_birth_date date,
  p_phone text,
  p_cep text default null,
  p_selfie_url text default null,
  p_lgpd_accepted boolean default null,
  p_family_id text default null,
  p_codigo_membro text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_session_profile_id uuid;
  v_full_name text;
  v_role_id uuid;
  v_session_token text;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  v_full_name := trim(coalesce(p_full_name, ''));

  if length(v_full_name) <= 3 then
    raise exception 'Informe o nome completo.';
  end if;

  if lower(v_full_name) = 'visitante' then
    raise exception 'Substitua o nome temporário de visitante pelo seu nome completo.';
  end if;

  if p_birth_date is null then
    raise exception 'Informe a data de nascimento.';
  end if;

  v_session_profile_id := public.current_session_profile_id();

  if v_session_profile_id is not null and v_session_profile_id <> p_profile_id then
    raise exception 'Sessão não corresponde ao perfil informado.';
  end if;

  select p.*
    into v_profile
    from public.profiles p
   where p.id = p_profile_id;

  if v_profile.id is null then
    raise exception 'Perfil não encontrado.';
  end if;

  if not public.profile_pending_self_registration(p_profile_id) then
    raise exception 'Este perfil já concluiu o cadastro inicial.';
  end if;

  if trim(coalesce(p_phone, '')) <> ''
     and public.normalize_profile_phone(v_profile.phone) is distinct from public.normalize_profile_phone(p_phone) then
    raise exception 'Telefone não confere com o perfil.';
  end if;

  begin
    update public.profiles p
       set full_name = v_full_name,
           birth_date = p_birth_date,
           cep = nullif(trim(coalesce(p_cep, '')), ''),
           selfie_url = nullif(trim(coalesce(p_selfie_url, '')), ''),
           lgpd_accepted = p_lgpd_accepted,
           family_id = nullif(trim(coalesce(p_family_id, '')), ''),
           codigo_membro = nullif(trim(coalesce(p_codigo_membro, '')), ''),
           updated_at = now()
     where p.id = p_profile_id
     returning p.* into v_profile;
  exception
    when undefined_column then
      update public.profiles p
         set full_name = v_full_name,
             birth_date = p_birth_date,
             cep = nullif(trim(coalesce(p_cep, '')), ''),
             selfie_url = nullif(trim(coalesce(p_selfie_url, '')), ''),
             lgpd_accepted = p_lgpd_accepted,
             codigo_membro = nullif(trim(coalesce(p_codigo_membro, '')), ''),
             updated_at = now()
       where p.id = p_profile_id
       returning p.* into v_profile;
  end;

  if not exists (
    select 1
      from public.profile_access_roles par
     where par.profile_id = p_profile_id
  )
  and not (
    trim(coalesce(v_profile.full_name, '')) ilike 'TstMax%'
    or coalesce(v_profile.family_id, '') like 'TstMax%'
    or coalesce(v_profile.codigo_membro, '') like 'TstMax%'
    or lower(trim(coalesce(v_profile.email, ''))) like '%@tstmax.demo'
  ) then
    select ar.id
      into v_role_id
      from public.access_roles ar
     where ar.code = 'congregado'
     limit 1;

    if v_role_id is not null then
      insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id)
      values (p_profile_id, v_role_id, p_profile_id)
      on conflict (profile_id, role_id) do nothing;
    end if;
  end if;

  v_session_token := public.issue_profile_session(p_profile_id);

  return jsonb_build_object(
    'success', true,
    'profile', to_jsonb(v_profile),
    'session_token', v_session_token
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.issue_profile_session(uuid, interval) to anon, authenticated;
grant execute on function public.resolve_profile_session_token(text) to anon, authenticated;
grant execute on function public.revoke_profile_session(text) to anon, authenticated;
grant execute on function public.current_session_profile_id() to anon, authenticated;
grant execute on function public.verificar_login(text, text) to anon, authenticated;
grant execute on function public.complete_initial_profile_registration(
  uuid, text, date, text, text, text, boolean, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
