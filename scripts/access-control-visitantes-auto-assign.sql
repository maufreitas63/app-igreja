-- Atribuição automática e obrigatória do papel `visitantes` a todo perfil novo.
-- Execute no SQL Editor do Supabase após:
--   scripts/access-control-schema.sql
--   scripts/access-control-visitantes-role.sql (ou access-control-congregado-visitantes-roles.sql)
--
-- Também atualiza RPCs de cadastro inicial e mudança de papéis para remover `visitantes`
-- ao promover para congregado/membro e restaurar ao rebaixar.

-- ---------------------------------------------------------------------------
-- Helper: garante papel visitantes (exceto perfis TstMax e quem já tem outro papel)
-- ---------------------------------------------------------------------------

create or replace function public.profile_is_tstmax_test_profile(p_profile_id uuid)
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
         trim(coalesce(p.full_name, '')) ilike 'TstMax%'
         or coalesce(p.family_id, '') like 'TstMax%'
         or coalesce(p.codigo_membro, '') like 'TstMax%'
         or lower(trim(coalesce(p.email, ''))) like '%@tstmax.demo'
       )
  );
$$;

create or replace function public.ensure_profile_visitantes_role(
  p_profile_id uuid,
  p_granted_by_profile_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
begin
  if p_profile_id is null then
    return false;
  end if;

  if public.profile_is_tstmax_test_profile(p_profile_id) then
    return false;
  end if;

  if exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code <> 'visitantes'
  ) then
    return false;
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = 'visitantes'
   limit 1;

  if v_role_id is null then
    return false;
  end if;

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id)
  values (p_profile_id, v_role_id, p_granted_by_profile_id)
  on conflict (profile_id, role_id) do nothing;

  return true;
end;
$$;

create or replace function public.remove_profile_visitantes_role(p_profile_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.profile_access_roles par
   using public.access_roles ar
   where par.profile_id = p_profile_id
     and par.role_id = ar.id
     and ar.code = 'visitantes';
$$;

-- Trigger: todo INSERT em profiles recebe visitantes automaticamente
create or replace function public.profiles_assign_visitantes_role_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_profile_visitantes_role(new.id);
  return new;
end;
$$;

drop trigger if exists trg_profiles_assign_visitantes_role on public.profiles;

create trigger trg_profiles_assign_visitantes_role
after insert on public.profiles
for each row
execute function public.profiles_assign_visitantes_role_trigger();

-- Perfis existentes sem nenhum papel → visitantes explícito
insert into public.profile_access_roles (profile_id, role_id)
select p.id, ar.id
  from public.profiles p
 cross join public.access_roles ar
 where ar.code = 'visitantes'
   and not public.profile_is_tstmax_test_profile(p.id)
   and not exists (
     select 1
       from public.profile_access_roles par
      where par.profile_id = p.id
   )
on conflict (profile_id, role_id) do nothing;

-- ---------------------------------------------------------------------------
-- Entrada por celular/PIN: reforço após ensure (idempotente)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_profile_for_access_pin(p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_formatted_phone text;
  v_digits text;
  v_created boolean := false;
begin
  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is not null then
    perform public.ensure_profile_visitantes_role(v_profile_id);
    return v_profile_id;
  end if;

  v_digits := public.normalize_profile_phone(p_phone);

  if v_digits is null or length(v_digits) < 10 then
    raise exception 'Celular inválido para preparar o cadastro.';
  end if;

  begin
    v_formatted_phone := public.format_phone_like_profiles(p_phone);
  exception
    when undefined_function then
      v_formatted_phone := null;
  end;

  if v_formatted_phone is null or v_formatted_phone = '' then
    if length(v_digits) = 11 then
      v_formatted_phone :=
        '(' || substring(v_digits from 1 for 2) || ') '
        || substring(v_digits from 3 for 5) || '-'
        || substring(v_digits from 8 for 4);
    elsif length(v_digits) = 10 then
      v_formatted_phone :=
        '(' || substring(v_digits from 1 for 2) || ') '
        || substring(v_digits from 3 for 4) || '-'
        || substring(v_digits from 7 for 4);
    else
      v_formatted_phone := v_digits;
    end if;
  end if;

  begin
    insert into public.profiles (phone, lgpd_accepted, is_active, full_name)
    values (v_formatted_phone, null, true, null)
    returning id into v_profile_id;
    v_created := true;
  exception
    when undefined_column then
      begin
        insert into public.profiles (phone, lgpd_accepted)
        values (v_formatted_phone, null)
        returning id into v_profile_id;
        v_created := true;
      exception
        when not_null_violation then
          insert into public.profiles (phone, lgpd_accepted, full_name)
          values (v_formatted_phone, null, 'Visitante')
          returning id into v_profile_id;
          v_created := true;
        when unique_violation then
          v_profile_id := null;
        when others then
          raise exception 'Falha ao criar perfil visitante: %', sqlerrm;
      end;
    when not_null_violation then
      begin
        insert into public.profiles (phone, lgpd_accepted, is_active, full_name)
        values (v_formatted_phone, null, true, 'Visitante')
        returning id into v_profile_id;
        v_created := true;
      exception
        when unique_violation then
          v_profile_id := null;
        when others then
          raise exception 'Falha ao criar perfil visitante: %', sqlerrm;
      end;
    when unique_violation then
      v_profile_id := null;
    when others then
      raise exception 'Falha ao criar perfil visitante: %', sqlerrm;
  end;

  if v_profile_id is null then
    v_profile_id := public.find_profile_id_by_phone(p_phone);
  end if;

  if v_profile_id is null then
    select p.id
      into v_profile_id
      from public.profiles p
     where public.normalize_profile_phone(p.phone) = v_digits
     order by p.updated_at desc nulls last
     limit 1;
  end if;

  if v_profile_id is null then
    raise exception 'Não foi possível preparar o perfil para este celular.';
  end if;

  perform public.ensure_profile_visitantes_role(v_profile_id);

  return v_profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cadastro inicial (/register): congregado substitui visitantes
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

  if not public.profile_is_tstmax_test_profile(p_profile_id)
     and not public.profile_has_role_code(p_profile_id, 'congregado')
     and not public.profile_has_role_code(p_profile_id, 'member') then
    perform public.remove_profile_visitantes_role(p_profile_id);

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

-- ---------------------------------------------------------------------------
-- Mudança pastoral: visitante = papel visitantes explícito
-- ---------------------------------------------------------------------------

create or replace function public.definir_papel_basico_perfil_pastoral(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_role_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
  v_current_role text;
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if public.profile_has_protected_role_for_pastoral_change(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este perfil possui papel protegido e não pode ser alterado por esta tela.'
    );
  end if;

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if v_role_code not in ('visitante', 'congregado', 'member') then
    return jsonb_build_object(
      'success', false,
      'message',
      'Papel inválido. Use visitante, congregado ou member.'
    );
  end if;

  v_current_role := public.resolve_basic_role_code_for_profile(p_target_profile_id);

  if v_current_role = v_role_code then
    return jsonb_build_object('success', true, 'message', 'Papel já estava definido.');
  end if;

  delete from public.profile_access_roles par
   using public.access_roles ar
   where par.role_id = ar.id
     and par.profile_id = p_target_profile_id
     and ar.code in ('member', 'congregado', 'visitantes');

  if v_role_code = 'visitante' then
    perform public.ensure_profile_visitantes_role(p_target_profile_id, p_actor_profile_id);

    return jsonb_build_object(
      'success', true,
      'message',
      'Perfil definido como visitante.'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado no sistema.');
  end if;

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id)
  on conflict (profile_id, role_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'message',
    case v_role_code
      when 'member' then 'Papel alterado para Membro.'
      when 'congregado' then 'Papel alterado para Congregado.'
      else 'Papel atualizado.'
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Controle de acesso admin: ao atribuir outro papel, remove visitantes;
-- ao revogar o último papel, restaura visitantes.
-- ---------------------------------------------------------------------------

create or replace function public.atribuir_papel_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_role_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  if v_role_code = 'visitantes' then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'O papel visitante é atribuído automaticamente na criação do perfil.'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  perform public.remove_profile_visitantes_role(p_target_profile_id);

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id)
  on conflict (profile_id, role_id) do nothing;

  return jsonb_build_object('success', true, 'message', 'Papel atribuído.');
end;
$$;

create or replace function public.revogar_papel_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_role_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
  v_remaining_super_admins integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  if v_role_code = 'super_admin' then
    select count(*)::integer
      into v_remaining_super_admins
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where ar.code = 'super_admin'
       and par.profile_id <> p_target_profile_id;

    if coalesce(v_remaining_super_admins, 0) = 0 then
      return jsonb_build_object(
        'success', false,
        'message', 'Não é possível remover o último super administrador.'
      );
    end if;
  end if;

  delete from public.profile_access_roles par
   where par.profile_id = p_target_profile_id
     and par.role_id = v_role_id;

  perform public.ensure_profile_visitantes_role(p_target_profile_id, p_actor_profile_id);

  return jsonb_build_object('success', true, 'message', 'Papel removido.');
end;
$$;

grant execute on function public.remove_profile_visitantes_role(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profile_has_role_code (usado pelo cadastro inicial)
-- ---------------------------------------------------------------------------

create or replace function public.profile_has_role_code(
  p_profile_id uuid,
  p_role_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code = lower(trim(coalesce(p_role_code, '')))
  );
$$;

grant execute on function public.profile_has_role_code(uuid, text) to anon, authenticated;
grant execute on function public.ensure_profile_visitantes_role(uuid, uuid) to anon, authenticated;
grant execute on function public.remove_profile_visitantes_role(uuid) to anon, authenticated;
grant execute on function public.profile_is_tstmax_test_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
