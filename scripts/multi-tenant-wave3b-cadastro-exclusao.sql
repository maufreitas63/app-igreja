-- =============================================================================
-- Multi-tenancy — onda 3b: cadastro inicial / exclusão / PIN / ministerial
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas (versões mais recentes usadas):
--   profile-sessions-04-registration.sql
--   delete-profile-complete-rpc.sql
--   access-control-visitantes-auto-assign.sql (ensure_profile_for_access_pin)
--   profiles-access-pin.sql (prepare_visitor_access_pin)
--   ministerial-profile-questionnaire.sql
--   ministerial-profile-questionnaire-session-fix.sql
-- Bootstrap público: coalesce(current_session_tenant_id(), resolve_default_tenant_id()).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- complete_initial_profile_registration
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
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_profile public.profiles%rowtype;
  v_session_profile_id uuid;
  v_full_name text;
  v_role_id uuid;
  v_session_token text;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

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
   where p.id = p_profile_id
     and (p.tenant_id = v_tenant or p.tenant_id is null);

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
           tenant_id = v_tenant,
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

  insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
  values (p_profile_id, v_tenant, true, true)
  on conflict (profile_id, tenant_id) do update
    set is_active = true,
        is_primary = true,
        updated_at = now();

  if not exists (
    select 1
      from public.profile_access_roles par
     where par.profile_id = p_profile_id
       and par.tenant_id = v_tenant
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
      insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id, tenant_id)
      values (p_profile_id, v_role_id, p_profile_id, v_tenant)
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

grant execute on function public.complete_initial_profile_registration(
  uuid, text, date, text, text, text, boolean, text, text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- excluir_usuario_completo
-- ---------------------------------------------------------------------------
create or replace function public.excluir_usuario_completo(
  p_target_profile_id uuid,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor_id uuid;
  v_profile public.profiles%rowtype;
  v_auth_user_id uuid;
  v_phone_digits text;
  v_super_admin_count bigint;
  v_deleted_expense_reports integer := 0;
  v_deleted_pastoral integer := 0;
  v_deleted_members integer := 0;
  v_deleted_registrations integer := 0;
  v_fk record;
begin
  v_actor_id := coalesce(p_actor_profile_id, public.current_session_profile_id());

  if v_actor_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.is_super_admin_profile(v_actor_id) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas super administradores podem excluir usuários.'
    );
  end if;

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Usuário não informado.');
  end if;

  if p_target_profile_id = v_actor_id then
    return jsonb_build_object(
      'success', false,
      'message', 'Não é possível excluir o próprio usuário da sessão.'
    );
  end if;

  select p.*
    into v_profile
    from public.profiles p
   where p.id = p_target_profile_id
     and p.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Usuário não encontrado.');
  end if;

  if public.is_super_admin_profile(p_target_profile_id) then
    select count(*)
      into v_super_admin_count
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where ar.code = 'super_admin'
       and par.tenant_id = v_tenant;

    if v_super_admin_count <= 1 then
      return jsonb_build_object(
        'success', false,
        'message', 'Não é possível excluir o único super administrador.'
      );
    end if;
  end if;

  v_auth_user_id := v_profile.auth_user_id;
  v_phone_digits := public.normalize_profile_phone(v_profile.phone);

  delete from public.expense_reports er
   where er.user_id = p_target_profile_id
     and er.tenant_id = v_tenant;
  get diagnostics v_deleted_expense_reports = row_count;

  delete from public.pastoral_requests pr
   where pr.tenant_id = v_tenant
     and (
       pr.profile_id = p_target_profile_id
       or (v_auth_user_id is not null and pr.user_id = v_auth_user_id)
       or (
         v_phone_digits is not null
         and v_phone_digits <> ''
         and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_phone_digits
       )
     );
  get diagnostics v_deleted_pastoral = row_count;

  if nullif(trim(coalesce(v_profile.full_name, '')), '') is not null then
    delete from public.voluntarios_escala ve
     where ve.tenant_id = v_tenant
       and lower(trim(ve.nome)) = lower(trim(v_profile.full_name));
  end if;

  delete from public.members m
   where m.tenant_id = v_tenant
     and (
       public.find_profile_id_for_member_sync(m.phone, m.full_name) = p_target_profile_id
       or (
         nullif(trim(coalesce(v_profile.full_name, '')), '') is not null
         and lower(trim(coalesce(m.full_name, ''))) = lower(trim(v_profile.full_name))
         and (
           nullif(public.normalize_phone_for_sync(m.phone), '') is null
           or nullif(v_phone_digits, '') is null
           or public.phones_match_for_sync(m.phone, v_profile.phone)
         )
       )
       or (
         nullif(v_phone_digits, '') is not null
         and public.phones_match_for_sync(m.phone, v_profile.phone)
       )
     );
  get diagnostics v_deleted_members = row_count;

  if v_phone_digits is not null and v_phone_digits <> '' then
    delete from public.profile_vehicles pv
     where pv.tenant_id = v_tenant
       and (
         public.normalize_profile_phone(pv.phone) = v_phone_digits
         or trim(coalesce(pv.phone, '')) = trim(coalesce(v_profile.phone, ''))
       );
  end if;

  delete from public.event_registrations er
   where er.profile_id = p_target_profile_id
     and er.tenant_id = v_tenant;
  get diagnostics v_deleted_registrations = row_count;

  for v_fk in
    select
      nsp.nspname as schema_name,
      rel.relname as table_name,
      att.attname as column_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_class frel on frel.oid = con.confrelid
    join pg_namespace fnsp on fnsp.oid = frel.relnamespace
    join unnest(con.conkey) with ordinality as ck(attnum, ord) on true
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = ck.attnum
     and not att.attisdropped
    where con.contype = 'f'
      and fnsp.nspname = 'public'
      and frel.relname = 'profiles'
      and nsp.nspname = 'public'
      and rel.relname <> 'profiles'
      and con.confdeltype in ('a', 'r')
  loop
    execute format(
      'delete from %I.%I where %I = $1',
      v_fk.schema_name,
      v_fk.table_name,
      v_fk.column_name
    )
    using p_target_profile_id;
  end loop;

  delete from public.profiles p
   where p.id = p_target_profile_id
     and p.tenant_id = v_tenant;

  if v_auth_user_id is not null then
    delete from auth.users u
     where u.id = v_auth_user_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'message',
    format(
      'Usuário %s excluído com sucesso.',
      coalesce(nullif(trim(v_profile.full_name), ''), p_target_profile_id::text)
    ),
    'profile_id', p_target_profile_id,
    'expense_reports_removed', v_deleted_expense_reports,
    'pastoral_requests_removed', v_deleted_pastoral,
    'members_removed', v_deleted_members,
    'event_registrations_removed', v_deleted_registrations
  );
exception
  when others then
    return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.excluir_usuario_completo(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ensure_profile_for_access_pin
-- ---------------------------------------------------------------------------
create or replace function public.ensure_profile_for_access_pin(p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_profile_id uuid;
  v_formatted_phone text;
  v_digits text;
  v_created boolean := false;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  v_digits := public.normalize_profile_phone(p_phone);

  if v_digits is not null and length(v_digits) >= 10 then
    select p.id
      into v_profile_id
      from public.profiles p
     where p.tenant_id = v_tenant
       and public.normalize_profile_phone(p.phone) = v_digits
     order by p.updated_at desc nulls last
     limit 1;
  end if;

  if v_profile_id is null then
    v_profile_id := public.find_profile_id_by_phone(p_phone);
    if v_profile_id is not null
       and not exists (
         select 1 from public.profiles p
          where p.id = v_profile_id and (p.tenant_id = v_tenant or p.tenant_id is null)
       ) then
      v_profile_id := null;
    end if;
  end if;

  if v_profile_id is not null then
    update public.profiles
       set tenant_id = coalesce(tenant_id, v_tenant),
           updated_at = now()
     where id = v_profile_id
       and tenant_id is distinct from v_tenant
       and tenant_id is null;

    insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
    values (v_profile_id, v_tenant, true, true)
    on conflict (profile_id, tenant_id) do update
      set is_active = true,
          updated_at = now();

    perform public.ensure_profile_visitantes_role(v_profile_id);
    return v_profile_id;
  end if;

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
    insert into public.profiles (phone, lgpd_accepted, is_active, full_name, tenant_id)
    values (v_formatted_phone, null, true, null, v_tenant)
    returning id into v_profile_id;
    v_created := true;
  exception
    when undefined_column then
      begin
        insert into public.profiles (phone, lgpd_accepted, tenant_id)
        values (v_formatted_phone, null, v_tenant)
        returning id into v_profile_id;
        v_created := true;
      exception
        when not_null_violation then
          insert into public.profiles (phone, lgpd_accepted, full_name, tenant_id)
          values (v_formatted_phone, null, 'Visitante', v_tenant)
          returning id into v_profile_id;
          v_created := true;
        when unique_violation then
          v_profile_id := null;
        when others then
          raise exception 'Falha ao criar perfil visitante: %', sqlerrm;
      end;
    when not_null_violation then
      begin
        insert into public.profiles (phone, lgpd_accepted, is_active, full_name, tenant_id)
        values (v_formatted_phone, null, true, 'Visitante', v_tenant)
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
    select p.id
      into v_profile_id
      from public.profiles p
     where p.tenant_id = v_tenant
       and public.normalize_profile_phone(p.phone) = v_digits
     order by p.updated_at desc nulls last
     limit 1;
  end if;

  if v_profile_id is null then
    raise exception 'Não foi possível preparar o perfil para este celular.';
  end if;

  insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
  values (v_profile_id, v_tenant, true, true)
  on conflict (profile_id, tenant_id) do update
    set is_active = true,
        is_primary = true,
        updated_at = now();

  perform public.ensure_profile_visitantes_role(v_profile_id);

  return v_profile_id;
end;
$$;

grant execute on function public.ensure_profile_for_access_pin(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- prepare_visitor_access_pin
-- ---------------------------------------------------------------------------
create or replace function public.prepare_visitor_access_pin(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_profile_id uuid;
  v_pin text;
  v_phone text;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  v_profile_id := public.ensure_profile_for_access_pin(p_phone);
  v_pin := public.random_access_pin();

  update public.profiles
     set access_pin = v_pin,
         tenant_id = coalesce(tenant_id, v_tenant),
         updated_at = now()
   where id = v_profile_id
  returning phone into v_phone;

  insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
  values (v_profile_id, v_tenant, true, true)
  on conflict (profile_id, tenant_id) do update
    set is_active = true,
        updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'pin', v_pin,
    'profile_id', v_profile_id,
    'phone', v_phone
  );
end;
$$;

grant execute on function public.prepare_visitor_access_pin(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- compute_ministerial_profile_scores
-- ---------------------------------------------------------------------------
create or replace function public.compute_ministerial_profile_scores(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_scores jsonb := '{}'::jsonb;
  v_row record;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  for v_row in
    select o.perfil_pontuado as perfil, count(*)::integer as total
      from public.ministerial_respostas r
      join public.ministerial_opcoes o on o.id = r.opcao_id
     where r.profile_id = p_profile_id
       and r.tenant_id = v_tenant
     group by o.perfil_pontuado
  loop
    v_scores := v_scores || jsonb_build_object(v_row.perfil, v_row.total);
  end loop;

  return v_scores;
end;
$$;

grant execute on function public.compute_ministerial_profile_scores(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- obter_resultado_questionario_ministerial
-- ---------------------------------------------------------------------------
create or replace function public.obter_resultado_questionario_ministerial(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_result record;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  perform public.ministerial_require_session_profile(p_profile_id);

  select
    r.perfil_vencedor,
    r.completed_at
  into v_result
  from public.ministerial_resultados r
  where r.profile_id = p_profile_id
    and r.tenant_id = v_tenant
  limit 1;

  if not found then
    return jsonb_build_object('success', true, 'has_result', false);
  end if;

  return jsonb_build_object(
    'success', true,
    'has_result', true,
    'perfil_vencedor', v_result.perfil_vencedor,
    'perfil_label', public.ministerial_profile_label(v_result.perfil_vencedor),
    'completed_at', v_result.completed_at
  );
end;
$$;

grant execute on function public.obter_resultado_questionario_ministerial(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- submeter_questionario_ministerial
-- ---------------------------------------------------------------------------
create or replace function public.submeter_questionario_ministerial(
  p_profile_id uuid,
  p_respostas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_total_perguntas integer;
  v_answer record;
  v_scores jsonb;
  v_winner text;
  v_seen integer := 0;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  perform public.ministerial_require_session_profile(p_profile_id);

  if p_respostas is null or jsonb_typeof(p_respostas) <> 'array' then
    return jsonb_build_object('success', false, 'message', 'Respostas inválidas.');
  end if;

  select count(*)::integer
    into v_total_perguntas
    from public.ministerial_perguntas;

  if v_total_perguntas <> 50 then
    return jsonb_build_object(
      'success', false,
      'message', 'Questionário incompleto no banco. Execute o seed das 50 perguntas.'
    );
  end if;

  if jsonb_array_length(p_respostas) <> v_total_perguntas then
    return jsonb_build_object(
      'success', false,
      'message', format('Informe as %s respostas do questionário.', v_total_perguntas)
    );
  end if;

  for v_answer in
    select
      nullif(trim(coalesce(value ->> 'pergunta_id', '')), '') as pergunta_id,
      nullif(trim(coalesce(value ->> 'opcao_id', '')), '') as opcao_id
    from jsonb_array_elements(p_respostas) as value
  loop
    if v_answer.pergunta_id is null or v_answer.opcao_id is null then
      return jsonb_build_object('success', false, 'message', 'Cada resposta precisa de pergunta e opção.');
    end if;

    if not exists (
      select 1
        from public.ministerial_perguntas p
       where p.id = v_answer.pergunta_id
    ) then
      return jsonb_build_object('success', false, 'message', 'Pergunta inválida: ' || v_answer.pergunta_id);
    end if;

    if not exists (
      select 1
        from public.ministerial_opcoes o
       where o.id = v_answer.opcao_id
         and o.pergunta_id = v_answer.pergunta_id
    ) then
      return jsonb_build_object('success', false, 'message', 'Opção inválida para a pergunta informada.');
    end if;

    v_seen := v_seen + 1;
  end loop;

  if v_seen <> v_total_perguntas then
    return jsonb_build_object('success', false, 'message', 'Há perguntas duplicadas ou ausentes.');
  end if;

  if (
    select count(distinct nullif(trim(coalesce(value ->> 'pergunta_id', '')), ''))
      from jsonb_array_elements(p_respostas) as value
  ) <> v_total_perguntas then
    return jsonb_build_object('success', false, 'message', 'Responda cada pergunta uma única vez.');
  end if;

  delete from public.ministerial_respostas
   where profile_id = p_profile_id
     and tenant_id = v_tenant;
  delete from public.ministerial_resultados
   where profile_id = p_profile_id
     and tenant_id = v_tenant;

  insert into public.ministerial_respostas (profile_id, pergunta_id, opcao_id, tenant_id)
  select
    p_profile_id,
    nullif(trim(coalesce(value ->> 'pergunta_id', '')), ''),
    nullif(trim(coalesce(value ->> 'opcao_id', '')), ''),
    v_tenant
  from jsonb_array_elements(p_respostas) as value;

  v_scores := public.compute_ministerial_profile_scores(p_profile_id);
  v_winner := public.resolve_ministerial_winner_profile(v_scores);

  if v_winner is null then
    return jsonb_build_object('success', false, 'message', 'Não foi possível calcular o perfil.');
  end if;

  insert into public.ministerial_resultados (profile_id, perfil_vencedor, pontuacao_detalhada, tenant_id)
  values (p_profile_id, v_winner, v_scores, v_tenant);

  return jsonb_build_object(
    'success', true,
    'perfil_vencedor', v_winner,
    'perfil_label', public.ministerial_profile_label(v_winner)
  );
end;
$$;

grant execute on function public.submeter_questionario_ministerial(uuid, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
