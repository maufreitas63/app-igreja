-- Sincroniza `profiles.family_id` / `codigo_membro` com `members.family_id`.
-- RPCs para Gerenciar Família:
--   • accept_managed_member_into_family — aceitar membro (usa family_id do gestor, ex.: IBN0001)
--   • detach_managed_member_from_family — excluir membro (novo código sequencial)
--   • sync_managed_member_profile_family — sincronização pontual members → profiles
-- Necessário porque o app não pode atualizar o perfil de outro usuário via RLS.
--
-- Execute no SQL Editor do Supabase.
-- Recomendado também: scripts/sync-member-family-id-with-profiles.sql (triggers automáticos).

create or replace function public.normalize_phone_for_sync(p_value text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
$$;

create or replace function public.find_profile_id_for_member_sync(
  p_phone text,
  p_full_name text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where
    (
      p_phone is not null
      and (
        p.phone = p_phone
        or public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(p_phone)
      )
    )
    or (
      nullif(trim(coalesce(p_full_name, '')), '') is not null
      and lower(trim(coalesce(p.full_name, ''))) = lower(trim(p_full_name))
    )
  order by
    case
      when p_phone is not null and p.phone = p_phone then 0
      when p_phone is not null and public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(p_phone) then 1
      else 2
    end,
    p.id
  limit 1;
$$;

create or replace function public.sync_managed_member_profile_family(
  p_member_id uuid,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_profile_id uuid;
  v_family_id text;
begin
  select *
    into v_member
  from public.members m
  where m.id = p_member_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não encontrado.'
    );
  end if;

  v_family_id := nullif(trim(coalesce(v_member.family_id, '')), '');

  if v_family_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro sem código de família para sincronizar.'
    );
  end if;

  v_profile_id := coalesce(
    p_profile_id,
    public.find_profile_id_for_member_sync(v_member.phone, v_member.full_name)
  );

  if v_profile_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Perfil vinculado ao membro não foi encontrado.'
    );
  end if;

  update public.profiles p
  set
    family_id = v_family_id,
    codigo_membro = v_family_id
  where p.id = v_profile_id
    and (
      p.family_id is distinct from v_family_id
      or p.codigo_membro is distinct from v_family_id
    );

  return jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'family_id', v_family_id
  );
end;
$$;

grant execute on function public.sync_managed_member_profile_family(uuid, uuid) to anon, authenticated;

-- Aceita membro na família do gestor: substitui family_id em members + profiles.
create or replace function public.accept_managed_member_into_family(
  p_member_id uuid,
  p_target_family_id text,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_target_family_id text;
  v_sync_result jsonb;
begin
  select *
    into v_member
  from public.members m
  where m.id = p_member_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não encontrado.'
    );
  end if;

  v_target_family_id := upper(trim(coalesce(p_target_family_id, '')));

  if v_target_family_id = '' then
    return jsonb_build_object(
      'success', false,
      'message', 'Código da família de destino inválido.'
    );
  end if;

  update public.members m
  set
    family_id = v_target_family_id,
    accepted = true
  where m.id = p_member_id;

  v_sync_result := public.sync_managed_member_profile_family(p_member_id, p_profile_id);

  return jsonb_build_object(
    'success', true,
    'family_id', v_target_family_id,
    'profile_sync', v_sync_result
  );
end;
$$;

grant execute on function public.accept_managed_member_into_family(uuid, text, uuid) to anon, authenticated;

-- Remove membro da família atual e emite novo código sequencial (Gerenciar Família → Excluir).
create or replace function public.detach_managed_member_from_family(
  p_member_id uuid,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_new_family_id text;
  v_sync_result jsonb;
begin
  select *
    into v_member
  from public.members m
  where m.id = p_member_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não encontrado.'
    );
  end if;

  v_new_family_id := public.reserve_next_family_id();

  update public.members m
  set
    family_id = v_new_family_id,
    accepted = false
  where m.id = p_member_id;

  v_sync_result := public.sync_managed_member_profile_family(p_member_id, p_profile_id);

  return jsonb_build_object(
    'success', true,
    'new_family_id', v_new_family_id,
    'profile_sync', v_sync_result
  );
exception
  when undefined_function then
    return jsonb_build_object(
      'success', false,
      'message', 'Função reserve_next_family_id ausente. Execute scripts/register-member-atomic.sql.'
    );
end;
$$;

grant execute on function public.detach_managed_member_from_family(uuid, uuid) to anon, authenticated;

-- Garante trigger com SECURITY DEFINER (RLS não bloqueia a sincronização automática).
create or replace function public.sync_profile_family_from_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_family_id text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_profile_id := public.find_profile_id_for_member_sync(new.phone, new.full_name);
  v_family_id := nullif(trim(coalesce(new.family_id, '')), '');

  if v_profile_id is null or v_family_id is null then
    return new;
  end if;

  update public.profiles p
  set
    family_id = v_family_id,
    codigo_membro = v_family_id
  where p.id = v_profile_id
    and (
      p.family_id is distinct from v_family_id
      or p.codigo_membro is distinct from v_family_id
    );

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_family_from_member on public.members;

create trigger trg_sync_profile_family_from_member
after insert or update of family_id, phone, full_name
on public.members
for each row
execute function public.sync_profile_family_from_member();

-- Corrige perfis já desalinhados com membros aceitos.
with matched_profiles as (
  select
    public.find_profile_id_for_member_sync(m.phone, m.full_name) as profile_id,
    nullif(trim(m.family_id), '') as family_id
  from public.members m
  where m.accepted is true
    and nullif(trim(m.family_id), '') is not null
)
update public.profiles p
set
  family_id = matched_profiles.family_id,
  codigo_membro = matched_profiles.family_id
from matched_profiles
where p.id = matched_profiles.profile_id
  and matched_profiles.family_id is not null
  and (
    p.family_id is distinct from matched_profiles.family_id
    or p.codigo_membro is distinct from matched_profiles.family_id
  );
