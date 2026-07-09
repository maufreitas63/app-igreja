create extension if not exists pgcrypto;

-- Autorização de uso de imagem e voz (LGPD + Lei 14.063/2020).
-- Execute no Supabase após access-control-schema.sql e profile-sessions.sql
--
-- Pendentes: pending_authorizations (magic link)
-- Imutáveis: authorizations (sem update/delete para usuários)
-- Bucket: authorizations (PDFs)

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'authorizations',
  'authorizations',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.pending_authorizations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid null references public.profiles (id) on delete set null,
  full_name text not null,
  email text not null,
  cpf text not null,
  phone text not null,
  token text not null,
  privacy_policy_version text not null default '1.0',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  constraint pending_authorizations_full_name_check
    check (char_length(trim(full_name)) > 3),
  constraint pending_authorizations_email_check
    check (public.is_valid_profile_email(email)),
  constraint pending_authorizations_token_unique unique (token)
);

create index if not exists pending_authorizations_token_idx
  on public.pending_authorizations (token);

create index if not exists pending_authorizations_profile_idx
  on public.pending_authorizations (profile_id, created_at desc);

create table if not exists public.authorizations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid null references public.profiles (id) on delete set null,
  full_name text not null,
  email text not null,
  cpf text not null,
  phone text not null,
  accepted_at timestamptz not null default now(),
  ip_address text null,
  user_agent text null,
  privacy_policy_version text not null,
  accepted_text_hash text not null,
  storage_path text null,
  confirmed_via_email boolean not null default true,
  constraint authorizations_full_name_check
    check (char_length(trim(full_name)) > 3),
  constraint authorizations_email_check
    check (public.is_valid_profile_email(email))
);

create index if not exists authorizations_profile_idx
  on public.authorizations (profile_id, accepted_at desc);

create index if not exists authorizations_cpf_idx
  on public.authorizations (cpf);

alter table public.authorizations
  add column if not exists confirmation_token text null;

create unique index if not exists authorizations_confirmation_token_uidx
  on public.authorizations (confirmation_token)
  where confirmation_token is not null;

-- ---------------------------------------------------------------------------
-- CPF (Módulo 11)
-- ---------------------------------------------------------------------------

create or replace function public.normalize_cpf_digits(p_cpf text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
$$;

create or replace function public.validate_cpf_digits(p_cpf text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_cpf text;
  v_sum integer;
  v_rest integer;
  v_digit1 integer;
  v_digit2 integer;
  i integer;
begin
  v_cpf := public.normalize_cpf_digits(p_cpf);

  if length(v_cpf) <> 11 then
    return false;
  end if;

  if v_cpf ~ '^(\d)\1{10}$' then
    return false;
  end if;

  v_sum := 0;
  for i in 1..9 loop
    v_sum := v_sum + (substring(v_cpf, i, 1)::integer * (11 - i));
  end loop;

  v_rest := (v_sum * 10) % 11;
  if v_rest = 10 then
    v_rest := 0;
  end if;

  v_digit1 := substring(v_cpf, 10, 1)::integer;
  if v_rest <> v_digit1 then
    return false;
  end if;

  v_sum := 0;
  for i in 1..10 loop
    v_sum := v_sum + (substring(v_cpf, i, 1)::integer * (12 - i));
  end loop;

  v_rest := (v_sum * 10) % 11;
  if v_rest = 10 then
    v_rest := 0;
  end if;

  v_digit2 := substring(v_cpf, 11, 1)::integer;
  return v_rest = v_digit2;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — pending (sessão própria)
-- ---------------------------------------------------------------------------

alter table public.pending_authorizations enable row level security;

drop policy if exists pending_authorizations_select_own on public.pending_authorizations;
create policy pending_authorizations_select_own
  on public.pending_authorizations
  for select
  to anon, authenticated
  using (
    profile_id is not null
    and profile_id = public.current_session_profile_id()
  );

drop policy if exists pending_authorizations_insert_own on public.pending_authorizations;
create policy pending_authorizations_insert_own
  on public.pending_authorizations
  for insert
  to anon, authenticated
  with check (
    profile_id is not null
    and profile_id = public.current_session_profile_id()
  );

drop policy if exists pending_authorizations_delete_own on public.pending_authorizations;
create policy pending_authorizations_delete_own
  on public.pending_authorizations
  for delete
  to anon, authenticated
  using (
    profile_id is not null
    and profile_id = public.current_session_profile_id()
  );

-- ---------------------------------------------------------------------------
-- RLS — authorizations (imutável: apenas leitura da própria sessão)
-- ---------------------------------------------------------------------------

alter table public.authorizations enable row level security;

drop policy if exists authorizations_select_own on public.authorizations;
create policy authorizations_select_own
  on public.authorizations
  for select
  to anon, authenticated
  using (
    profile_id is not null
    and profile_id = public.current_session_profile_id()
  );

-- Sem políticas de insert/update/delete direto — apenas via RPC security definer.

grant select on public.pending_authorizations to anon, authenticated;
grant insert, delete on public.pending_authorizations to anon, authenticated;
grant select on public.authorizations to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage RLS
-- ---------------------------------------------------------------------------

drop policy if exists authorizations_storage_select on storage.objects;
create policy authorizations_storage_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'authorizations'
    and (
      public.can_manage_maintenance_support()
      or exists (
        select 1
          from public.authorizations a
         where a.storage_path = storage.objects.name
           and a.profile_id = public.current_session_profile_id()
      )
    )
  );

drop policy if exists authorizations_storage_insert_service on storage.objects;
create policy authorizations_storage_insert_service
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'authorizations');

notify pgrst, 'reload schema';
