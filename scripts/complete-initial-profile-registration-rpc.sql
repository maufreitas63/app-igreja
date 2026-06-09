-- Cadastro inicial (/register): grava nome, nascimento, CEP, selfie e LGPD
-- em perfil visitante pendente e concede papel congregado para Dados cadastrais.
-- Execute no SQL Editor do Supabase após preparar-perfil-acesso-cadastro.sql.

create or replace function public.profile_pending_self_registration(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = p_profile_id
       and (
         p.birth_date is null
         or trim(coalesce(p.full_name, '')) = ''
         or lower(trim(coalesce(p.full_name, ''))) = 'visitante'
       )
  );
$$;

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

  return jsonb_build_object(
    'success', true,
    'profile', to_jsonb(v_profile)
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.profile_pending_self_registration(uuid) to anon, authenticated;
grant execute on function public.complete_initial_profile_registration(
  uuid, text, date, text, text, text, boolean, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
