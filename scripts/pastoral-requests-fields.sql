-- Campos do pedido "Coração Aberto" em `public.pastoral_requests`.
-- Execute no SQL Editor do Supabase (script completo).
-- Requer: scripts/access-control-security-hardening.sql (assert_session_profile_matches).
--
-- O app identifica o membro por `profiles.id` (login com PIN).
-- `user_id` na tabela original referencia `auth.users` — muitos perfis não têm auth.
-- Por isso gravamos `profile_id` (obrigatório) e `user_id` só quando existir `profiles.auth_user_id`.

alter table public.pastoral_requests
  add column if not exists phone text,
  add column if not exists motivo text,
  add column if not exists situacao text,
  add column if not exists destination_label text,
  add column if not exists confidential boolean not null default false,
  add column if not exists request_for text,
  add column if not exists beneficiary_name text,
  add column if not exists beneficiary_relationship text,
  add column if not exists beneficiary_details text;

alter table public.pastoral_requests
  drop constraint if exists pastoral_requests_request_for_check;

alter table public.pastoral_requests
  add constraint pastoral_requests_request_for_check
  check (
    request_for is null
    or request_for in ('self', 'family', 'third_party')
  );

alter table public.pastoral_requests
  add column if not exists profile_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pastoral_requests_profile_id_fkey'
  ) then
    alter table public.pastoral_requests
      add constraint pastoral_requests_profile_id_fkey
      foreign key (profile_id)
      references public.profiles (id);
  end if;
exception
  when duplicate_object then
    null;
end
$$;

-- Pedidos via app (PIN) podem não ter linha em auth.users
alter table public.pastoral_requests
  alter column user_id drop not null;

create index if not exists idx_pastoral_requests_profile_id
  on public.pastoral_requests (profile_id);

create index if not exists idx_pastoral_requests_destination_label
  on public.pastoral_requests (destination_label);

create index if not exists idx_pastoral_requests_confidential
  on public.pastoral_requests (confidential);

-- Remove RPCs antigas
drop function if exists public.insert_pastoral_request(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
);

drop function if exists public.insert_pastoral_request(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean,
  text,
  text,
  text,
  text
);

create or replace function public.insert_pastoral_request(
  p_user_id uuid,
  p_phone text,
  p_motivo text,
  p_situacao text,
  p_description text,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_destination_label text,
  p_confidential boolean,
  p_request_for text default 'self',
  p_beneficiary_name text default null,
  p_beneficiary_relationship text default null,
  p_beneficiary_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_profile_id uuid;
  v_auth_user_id uuid;
  v_category_id uuid;
  v_subcategory_id uuid;
  v_request_for text;
  v_beneficiary_name text;
  v_beneficiary_relationship text;
  v_beneficiary_details text;
begin
  -- p_user_id = profiles.id (enviado pelo app)
  perform public.assert_session_profile_matches(p_user_id);
  v_profile_id := p_user_id;

  select p.auth_user_id
  into v_auth_user_id
  from public.profiles p
  where p.id = v_profile_id;

  if not found then
    raise exception 'Perfil não encontrado para este usuário.';
  end if;

  if nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'Celular não informado.';
  end if;

  if nullif(trim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Motivo não informado.';
  end if;

  if nullif(trim(coalesce(p_situacao, '')), '') is null then
    raise exception 'Situação não informada.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Descrição não informada.';
  end if;

  v_request_for := coalesce(trim(p_request_for), 'self');

  if v_request_for not in ('self', 'family', 'third_party') then
    raise exception 'Tipo de beneficiário inválido.';
  end if;

  if v_request_for = 'self' then
    v_beneficiary_name := null;
    v_beneficiary_relationship := null;
    v_beneficiary_details := null;
  elsif v_request_for = 'family' then
    v_beneficiary_name := nullif(trim(coalesce(p_beneficiary_name, '')), '');
    v_beneficiary_relationship := nullif(trim(coalesce(p_beneficiary_relationship, '')), '');
    v_beneficiary_details := null;

    if v_beneficiary_name is null then
      raise exception 'Informe o nome do familiar.';
    end if;

    if v_beneficiary_relationship is null then
      raise exception 'Informe o grau de parentesco.';
    end if;
  else
    v_beneficiary_name := nullif(trim(coalesce(p_beneficiary_name, '')), '');
    v_beneficiary_relationship := null;
    v_beneficiary_details := nullif(trim(coalesce(p_beneficiary_details, '')), '');

    if v_beneficiary_name is null then
      raise exception 'Informe o nome do necessitado.';
    end if;

    if v_beneficiary_details is null then
      raise exception 'Especifique quem é o necessitado (terceiros).';
    end if;
  end if;

  v_category_id := p_category_id;
  v_subcategory_id := p_subcategory_id;

  if v_category_id is not null
    and not exists (
      select 1 from public.pastoral_reason_categories where id = v_category_id
    ) then
    v_category_id := null;
  end if;

  if v_subcategory_id is not null
    and not exists (
      select 1 from public.pastoral_reason_subcategories where id = v_subcategory_id
    ) then
    v_subcategory_id := null;
  end if;

  insert into public.pastoral_requests (
    user_id,
    profile_id,
    phone,
    motivo,
    situacao,
    description,
    category_id,
    subcategory_id,
    destination_label,
    confidential,
    request_for,
    beneficiary_name,
    beneficiary_relationship,
    beneficiary_details,
    urgency_level,
    status
  )
  values (
    v_auth_user_id,
    v_profile_id,
    trim(p_phone),
    trim(p_motivo),
    trim(p_situacao),
    trim(p_description),
    v_category_id,
    v_subcategory_id,
    nullif(trim(coalesce(p_destination_label, '')), ''),
    coalesce(p_confidential, false),
    v_request_for,
    v_beneficiary_name,
    v_beneficiary_relationship,
    v_beneficiary_details,
    1,
    'new'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.insert_pastoral_request(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean,
  text,
  text,
  text,
  text
) to anon;

grant execute on function public.insert_pastoral_request(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean,
  text,
  text,
  text,
  text
) to authenticated;

-- Histórico ("Meus pedidos") — contorna RLS no SELECT
drop function if exists public.list_my_pastoral_requests(uuid);

create or replace function public.list_my_pastoral_requests(p_profile_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  motivo text,
  situacao text,
  description text,
  destination_label text,
  request_for text,
  beneficiary_name text,
  beneficiary_relationship text,
  beneficiary_details text,
  status text,
  confidential boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_phone_digits text;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  select regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  into v_profile_phone_digits
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  return query
  select
    pr.id,
    pr.created_at,
    pr.motivo,
    pr.situacao,
    pr.description,
    pr.destination_label,
    pr.request_for,
    pr.beneficiary_name,
    pr.beneficiary_relationship,
    pr.beneficiary_details,
    pr.status::text,
    coalesce(pr.confidential, false)
  from public.pastoral_requests pr
  where pr.profile_id = p_profile_id
    or (
      v_profile_phone_digits <> ''
      and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_profile_phone_digits
    )
  order by pr.created_at desc;
end;
$$;

grant execute on function public.list_my_pastoral_requests(uuid) to anon;
grant execute on function public.list_my_pastoral_requests(uuid) to authenticated;

notify pgrst, 'reload schema';
