-- =============================================================================
-- Multi-tenancy — onda 2c: mídia / recepção / app_parameters (tenant isolation)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas:
--   media-authorization-rpc.sql / media-authorization-pdf-rpc-patch.sql
--   recepcao-cadastro-familiar.sql
--   get-app-parameter-value.sql / salvar-app-parameter-admin.sql
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- submit_media_authorization_pending
-- ---------------------------------------------------------------------------
create or replace function public.submit_media_authorization_pending(
  p_full_name text,
  p_email text,
  p_cpf text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile_id uuid;
  v_token text;
  v_pending_id uuid;
  v_app_url text;
  v_confirm_url text;
  v_email_sent boolean := false;
  v_send_result jsonb;
begin
  v_profile_id := public.resolve_profile_id_for_media_authorization();

  if v_profile_id is null then
    return jsonb_build_object(
      'ok', false,
      'sessionValid', false,
      'message', 'Sessão expirada. Saia e entre novamente com o PIN enviado ao seu e-mail.',
      'debugHint', 'Chame debug_media_authorization_submit_context no app (F12) para ver token/profile-id.'
    );
  end if;

  if not public.validate_cpf_digits(p_cpf) then
    return jsonb_build_object('ok', false, 'message', 'CPF inválido.');
  end if;

  if not public.is_valid_profile_email(p_email) then
    return jsonb_build_object('ok', false, 'message', 'E-mail inválido.');
  end if;

  if length(trim(coalesce(p_full_name, ''))) <= 3 then
    return jsonb_build_object('ok', false, 'message', 'Informe o nome completo.');
  end if;

  if length(public.normalize_cpf_digits(p_phone)) < 10 then
    return jsonb_build_object('ok', false, 'message', 'Telefone inválido.');
  end if;

  delete from public.pending_authorizations
   where tenant_id = v_tenant
     and profile_id = v_profile_id;

  v_token := public.media_authorization_new_token();

  insert into public.pending_authorizations (
    profile_id,
    full_name,
    email,
    cpf,
    phone,
    token,
    privacy_policy_version, tenant_id)
  values (
    v_profile_id,
    trim(p_full_name),
    lower(trim(p_email)),
    public.normalize_cpf_digits(p_cpf),
    trim(p_phone),
    v_token,
    '1.0',
    v_tenant)
  returning id into v_pending_id;

  v_app_url := coalesce(
    public.get_app_parameter_value_trim('media_authorization_app_url'),
    public.get_app_parameter_value_trim('app_public_url'),
    'https://localhost:8081'
  );

  v_confirm_url := rtrim(v_app_url, '/') || '/autorizacao-midia-confirmar?token=' || v_token;

  -- Mesmo caminho do teste 03 / 03b (send_media_authorization_pending_email → send_resend_transactional_email).
  begin
    v_send_result := public.send_media_authorization_pending_email(
      lower(trim(p_email)),
      trim(p_full_name),
      v_confirm_url
    );
    v_email_sent := true;
  exception
    when others then
      return jsonb_build_object(
        'ok', false,
        'emailSent', false,
        'sessionValid', true,
        'pendingId', v_pending_id,
        'pendingKept', true,
        'message', SQLERRM
      );
  end;

  if not v_email_sent then
    return jsonb_build_object(
      'ok', false,
      'emailSent', false,
      'sessionValid', true,
      'pendingId', v_pending_id,
      'pendingKept', true,
      'message', coalesce(v_send_result::text, 'O provedor de e-mail não confirmou o envio.')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'emailSent', v_email_sent,
    'sessionValid', true,
    'emailProvider', coalesce(v_send_result->>'provider', null),
    'resendId', coalesce(v_send_result->>'resendId', null),
    'message', 'Enviamos um link de confirmação para o seu e-mail. Abra-o para concluir a autorização.',
    'pendingId', v_pending_id,
    'emailMasked', public.mask_profile_email(lower(trim(p_email)))
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'message', SQLERRM);
end;
$$;

grant execute on function public.submit_media_authorization_pending(text, text, text, text) to anon;
grant execute on function public.submit_media_authorization_pending(text, text, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- confirm_media_authorization
-- ---------------------------------------------------------------------------
create or replace function public.confirm_media_authorization(
  p_token text,
  p_ip_address text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_pending public.pending_authorizations%rowtype;
  v_authorization_id uuid;
  v_pdf_result jsonb;
  v_token text;
  v_existing_storage_path text;
begin
  v_token := public.normalize_media_authorization_token(p_token);

  if v_token is null then
    return jsonb_build_object('ok', false, 'message', 'Token inválido.');
  end if;

  select a.id
    into v_authorization_id
    from public.authorizations a
   where a.confirmation_token = v_token
   limit 1;

  if v_authorization_id is not null then
    select a.storage_path
      into v_existing_storage_path
      from public.authorizations a
     where a.id = v_authorization_id;

    return jsonb_build_object(
      'ok', true,
      'message', 'Autorização já confirmada com sucesso.',
      'authorizationId', v_authorization_id,
      'alreadyConfirmed', true,
      'storagePath', v_existing_storage_path
    );
  end if;

  select *
    into v_pending
    from public.pending_authorizations
   where token = v_token
   limit 1
   for update;

  if v_pending.id is null then
    return jsonb_build_object('ok', false, 'message', 'Link inválido ou já utilizado. Solicite um novo envio pelo aplicativo.');
  end if;

  
  v_tenant := v_pending.tenant_id;
  if v_tenant is null then
    v_tenant := public.resolve_default_tenant_id();
  end if;
  if v_tenant is null then
    raise exception 'Tenant não encontrado para autorização pendente.';
  end if;

  if v_pending.expires_at < now() then
    delete from public.pending_authorizations where tenant_id = v_tenant
     and id = v_pending.id;
    return jsonb_build_object('ok', false, 'message', 'Este link expirou. Solicite um novo envio.');
  end if;

  if not public.validate_cpf_digits(v_pending.cpf) then
    return jsonb_build_object('ok', false, 'message', 'CPF inválido no registro pendente.');
  end if;

  insert into public.authorizations (
    profile_id,
    full_name,
    email,
    cpf,
    phone,
    accepted_at,
    ip_address,
    user_agent,
    privacy_policy_version,
    accepted_text_hash,
    confirmed_via_email,
    confirmation_token, tenant_id)
  values (
    v_pending.profile_id,
    v_pending.full_name,
    v_pending.email,
    v_pending.cpf,
    v_pending.phone,
    now(),
    nullif(trim(p_ip_address), ''),
    nullif(trim(p_user_agent), ''),
    v_pending.privacy_policy_version,
    public.media_authorization_terms_hash(),
    true,
    v_token,
    v_tenant)
  returning id into v_authorization_id;

  delete from public.pending_authorizations where tenant_id = v_tenant
     and id = v_pending.id;

  v_pdf_result := public.invoke_media_authorization_pdf_generation(v_authorization_id);

  return jsonb_build_object(
    'ok', true,
    'message', 'Autorização confirmada com sucesso.',
    'authorizationId', v_authorization_id,
    'storagePath', coalesce(v_pdf_result->>'storagePath', null),
    'pdfGenerated', coalesce(v_pdf_result->>'ok', 'false') = 'true',
    'pdfMessage', coalesce(v_pdf_result->>'message', null)
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'message', SQLERRM);
end;
$$;

grant execute on function public.confirm_media_authorization(text, text, text) to anon;
grant execute on function public.confirm_media_authorization(text, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- invoke_media_authorization_pdf_generation
-- ---------------------------------------------------------------------------
create or replace function public.invoke_media_authorization_pdf_generation(p_authorization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_tenant uuid;
  v_pdf_function_url text;
  v_pdf_function_secret text;
  v_status integer;
  v_content text;
  v_body jsonb;
  v_payload jsonb;
  v_storage_path text;
begin
  select a.tenant_id
    into v_tenant
    from public.authorizations a
   where a.id = p_authorization_id;
  if v_tenant is null then
    v_tenant := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  end if;
  if v_tenant is null then
    raise exception 'Tenant não encontrado para a autorização.';
  end if;

  if p_authorization_id is null then
    return jsonb_build_object('ok', false, 'message', 'Autorização não informada.');
  end if;

  if not exists (select 1 from public.authorizations a where a.tenant_id = v_tenant
    and  a.id = p_authorization_id) then
    return jsonb_build_object('ok', false, 'message', 'Autorização não encontrada.');
  end if;

  v_pdf_function_url := public.get_app_parameter_value_trim('media_authorization_pdf_function_url');
  v_pdf_function_secret := public.get_app_parameter_value_trim('media_authorization_pdf_function_secret');

  if v_pdf_function_url is null or v_pdf_function_secret is null then
    return jsonb_build_object(
      'ok', false,
      'skipped', true,
      'message', 'PDF não configurado. Cadastre media_authorization_pdf_function_url e media_authorization_pdf_function_secret em app_parameters.'
    );
  end if;

  v_body := jsonb_build_object(
    'authorizationId', p_authorization_id,
    'secret', v_pdf_function_secret
  );

  select p.p_status, p.p_content
    into v_status, v_content
    from public.password_recovery_http_post(
      v_pdf_function_url,
      jsonb_build_object(
        'content-type', 'application/json',
        'authorization', 'Bearer ' || v_pdf_function_secret
      ),
      v_body::text
    ) as p;

  if coalesce(v_status, 0) not between 200 and 299 then
    return jsonb_build_object(
      'ok', false,
      'message',
      format(
        'Falha ao gerar PDF (HTTP %s). %s',
        coalesce(v_status, 0),
        coalesce(nullif(trim(v_content), ''), 'Verifique a Edge Function generate-authorization-pdf.')
      )
    );
  end if;

  begin
    v_payload := v_content::jsonb;
  exception
    when others then
      return jsonb_build_object(
        'ok', false,
        'message', 'Resposta inválida da Edge Function PDF.',
        'raw', coalesce(v_content, '')
      );
  end;

  if coalesce(v_payload->>'ok', '') <> 'true' then
    return jsonb_build_object(
      'ok', false,
      'message', coalesce(nullif(trim(v_payload->>'message'), ''), 'Edge Function PDF retornou erro.')
    );
  end if;

  v_storage_path := nullif(trim(v_payload->>'storagePath'), '');

  if v_storage_path is not null then
    update public.authorizations
       set storage_path = v_storage_path
     where tenant_id = v_tenant
     and id = p_authorization_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'storagePath', v_storage_path,
    'message', 'PDF gerado com sucesso.'
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'message', SQLERRM);
end;
$$;

grant execute on function public.invoke_media_authorization_pdf_generation(uuid) to anon;
grant execute on function public.invoke_media_authorization_pdf_generation(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- retry_media_authorization_pdf
-- ---------------------------------------------------------------------------
create or replace function public.retry_media_authorization_pdf(p_authorization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_profile_id uuid;
begin
  select a.tenant_id
    into v_tenant
    from public.authorizations a
   where a.id = p_authorization_id;
  if v_tenant is null then
    v_tenant := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  end if;
  if v_tenant is null then
    raise exception 'Tenant não encontrado para a autorização.';
  end if;

  v_profile_id := public.resolve_profile_id_for_media_authorization();

  if v_profile_id is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Sessão expirada. Faça login novamente.'
    );
  end if;

  if not exists (
    select 1
      from public.authorizations a
     where a.tenant_id = v_tenant
    and  a.id = p_authorization_id
       and a.profile_id = v_profile_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Autorização não encontrada para o seu perfil.'
    );
  end if;

  return public.invoke_media_authorization_pdf_generation(p_authorization_id);
end;
$$;

grant execute on function public.retry_media_authorization_pdf(uuid) to anon;
grant execute on function public.retry_media_authorization_pdf(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- list_recepcao_cadastro_familiar_pending
-- ---------------------------------------------------------------------------
create or replace function public.list_recepcao_cadastro_familiar_pending(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
        'submission_id', l.id,
        'created_at', l.created_at,
        'member_count', l.member_count,
        'detected_family_id', l.detected_family_id,
        'has_family_conflict', l.has_family_conflict,
        'members', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'full_name', m.full_name,
              'is_informant', m.is_informant,
              'relationship', m.relationship,
              'phone', m.phone,
              'birth_date', m.birth_date,
              'detected_family_id', m.detected_family_id,
              'matched_profile_id', m.matched_profile_id,
              'matched_member_id', m.matched_member_id
            )
            order by m.is_informant desc, m.full_name
          ), '[]'::jsonb)
          from public.recepcao_cadastro_familiar m
          where m.tenant_id = v_tenant
    and  m.submission_id = l.id
            and m.status = 'pending'
        )
      ) as row_data,
      l.created_at
      from public.recepcao_cadastro_familiar_lote l
      where l.tenant_id = v_tenant
    and  l.status = 'pending'
      order by l.created_at desc
      limit greatest(coalesce(p_limit, 50), 1)
    ) q;

  return jsonb_build_object('success', true, 'submissions', v_rows);
end;
$$;

grant execute on function public.list_recepcao_cadastro_familiar_pending(integer) to anon;
grant execute on function public.list_recepcao_cadastro_familiar_pending(integer) to authenticated;


-- ---------------------------------------------------------------------------
-- process_recepcao_cadastro_familiar_batch
-- ---------------------------------------------------------------------------
create or replace function public.process_recepcao_cadastro_familiar_batch(
  p_submission_ids uuid[] default null,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_submission record;
  v_member record;
  v_family_id text;
  v_processed_submissions int := 0;
  v_processed_members int := 0;
  v_skipped_conflicts int := 0;
  v_messages text[] := array[]::text[];
  v_apply_profile_id uuid;
  v_apply_member_id uuid;
  v_existing_profile_name text;
  v_existing_member_name text;
  v_address_process_message text;
begin
  for v_submission in
    select l.*
      from public.recepcao_cadastro_familiar_lote l
     where l.tenant_id = v_tenant
    and  l.status = 'pending'
       and (
         p_submission_ids is null
         or cardinality(p_submission_ids) = 0
         or l.id = any (p_submission_ids)
       )
     order by l.created_at
  loop
    if v_submission.has_family_conflict then
      v_skipped_conflicts := v_skipped_conflicts + 1;
      v_messages := array_append(
        v_messages,
        format('Lote %s ignorado: códigos familiares divergentes entre integrantes.', v_submission.id)
      );
      continue;
    end if;

    v_family_id := public.resolve_recepcao_lote_family_id(v_submission.id);

    if v_family_id is null then
      v_family_id := public.reserve_next_family_id();
    end if;

    perform set_config('app.skip_family_sync_trigger', 'on', true);

    for v_member in
      select *
        from public.recepcao_cadastro_familiar r
       where r.tenant_id = v_tenant
    and  r.submission_id = v_submission.id
         and r.status = 'pending'
       order by r.is_informant desc, r.created_at
    loop
      v_apply_profile_id := v_member.matched_profile_id;
      v_apply_member_id := v_member.matched_member_id;

      if public.recepcao_phone_claimed_by_other_profile(v_member.phone, v_member.full_name) then
        v_apply_profile_id := null;
        v_apply_member_id := null;
      end if;

      if v_apply_profile_id is not null then
        select nullif(trim(coalesce(p.full_name, '')), '')
          into v_existing_profile_name
          from public.profiles p
         where p.tenant_id = v_tenant
    and  p.id = v_apply_profile_id;

        if v_existing_profile_name is null
           or lower(v_existing_profile_name) <> lower(trim(v_member.full_name)) then
          v_apply_profile_id := null;
        end if;
      end if;

      if v_apply_member_id is not null then
        select nullif(trim(coalesce(m.full_name, '')), '')
          into v_existing_member_name
          from public.members m
         where m.tenant_id = v_tenant
    and  m.id = v_apply_member_id;

        if v_existing_member_name is null
           or lower(v_existing_member_name) <> lower(trim(v_member.full_name)) then
          v_apply_member_id := null;
        end if;
      end if;

      if v_apply_profile_id is not null then
        update public.profiles p
           set full_name = v_member.full_name,
               birth_date = v_member.birth_date,
               phone = coalesce(
                 public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
                 p.phone
               ),
               family_id = v_family_id,
               codigo_membro = v_family_id,
               medical_food_alerts = coalesce(v_member.medical_food_alerts, p.medical_food_alerts),
               is_active = false
         where p.id = v_apply_profile_id;
      else
        insert into public.profiles (
          full_name,
          birth_date,
          phone,
          family_id,
          codigo_membro,
          medical_food_alerts,
          is_active, tenant_id) values (
          v_member.full_name,
          v_member.birth_date,
          public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
          v_family_id,
          v_family_id,
          v_member.medical_food_alerts,
          false,
    v_tenant)
        returning id into v_apply_profile_id;
      end if;

      v_address_process_message := null;

      if v_apply_profile_id is not null
         and (
           nullif(trim(coalesce(v_member.cep, '')), '') is not null
           or coalesce(
                nullif(trim(coalesce(v_member.address_street, '')), ''),
                nullif(trim(coalesce(v_member.address_city, '')), '')
              ) is not null
         ) then
        v_address_process_message := public.apply_recepcao_address_to_profile(
          v_apply_profile_id,
          v_member.cep,
          v_member.address_street,
          v_member.address_neighborhood,
          v_member.address_city,
          v_member.address_state,
          v_member.address_number,
          v_member.address_complement
        );
      end if;

      if v_apply_member_id is not null then
        update public.members m
           set full_name = v_member.full_name,
               birth_date = v_member.birth_date,
               phone = coalesce(
                 public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
                 m.phone
               ),
               relationship = v_member.relationship,
               family_id = v_family_id,
               accepted = true
         where m.id = v_apply_member_id;
      else
        insert into public.members (
          full_name,
          birth_date,
          phone,
          relationship,
          family_id,
          accepted, tenant_id) values (
          v_member.full_name,
          v_member.birth_date,
          public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
          v_member.relationship,
          v_family_id,
          true,
    v_tenant)
        returning id into v_apply_member_id;
      end if;

      update public.recepcao_cadastro_familiar
         set status = 'processed',
             applied_family_id = v_family_id,
             applied_profile_id = v_apply_profile_id,
             applied_member_id = v_apply_member_id,
             processed_at = now(),
             process_message = coalesce(
               v_address_process_message,
               'Gravado em profiles e members.'
             )
       where tenant_id = v_tenant
     and id = v_member.id;

      v_processed_members := v_processed_members + 1;
    end loop;

    perform set_config('app.skip_family_sync_trigger', 'off', true);

    perform public.finalize_recepcao_lote_family_assignments(v_submission.id, v_family_id);

    update public.recepcao_cadastro_familiar_lote
       set status = 'processed',
           detected_family_id = v_family_id,
           processed_at = now(),
           process_message = format('Processado por lote. family_id=%s', v_family_id)
     where tenant_id = v_tenant
     and id = v_submission.id;

    v_processed_submissions := v_processed_submissions + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'processed_submissions', v_processed_submissions,
    'processed_members', v_processed_members,
    'skipped_conflicts', v_skipped_conflicts,
    'messages', v_messages
  );
exception
  when others then
    perform set_config('app.skip_family_sync_trigger', 'off', true);
    return jsonb_build_object(
      'success', false,
      'message',
      coalesce(sqlerrm, 'Não foi possível processar a recepção em lote.')
    );
end;
$$;

grant execute on function public.process_recepcao_cadastro_familiar_batch(uuid[], uuid) to anon;
grant execute on function public.process_recepcao_cadastro_familiar_batch(uuid[], uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- reject_recepcao_cadastro_familiar_batch
-- ---------------------------------------------------------------------------
create or replace function public.reject_recepcao_cadastro_familiar_batch(
  p_submission_ids uuid[],
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_count int := 0;
begin
  if p_submission_ids is null or cardinality(p_submission_ids) = 0 then
    return jsonb_build_object('success', false, 'message', 'Informe ao menos um lote.');
  end if;

  update public.recepcao_cadastro_familiar
     set status = 'rejected',
         processed_at = now(),
         process_message = coalesce(nullif(trim(p_reason), ''), 'Rejeitado pela equipe.')
   where tenant_id = v_tenant
     and submission_id = any (p_submission_ids)
     and status = 'pending';

  get diagnostics v_count = row_count;

  update public.recepcao_cadastro_familiar_lote
     set status = 'rejected',
         processed_at = now(),
         process_message = coalesce(nullif(trim(p_reason), ''), 'Rejeitado pela equipe.')
   where tenant_id = v_tenant
     and id = any (p_submission_ids)
     and status = 'pending';

  return jsonb_build_object(
    'success', true,
    'rejected_members', v_count
  );
end;
$$;

grant execute on function public.reject_recepcao_cadastro_familiar_batch(uuid[], text) to anon;
grant execute on function public.reject_recepcao_cadastro_familiar_batch(uuid[], text) to authenticated;


-- ---------------------------------------------------------------------------
-- submit_family_registration_public
-- ---------------------------------------------------------------------------
create or replace function public.submit_family_registration_public(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_submission_id uuid;
  v_informant jsonb;
  v_dependent jsonb;
  v_informant_name text;
  v_informant_birth date;
  v_dependent_name text;
  v_birth date;
  v_phone text;
  v_relationship text;
  v_cep text;
  v_address_number text;
  v_address_complement text;
  v_address_street text;
  v_address_neighborhood text;
  v_address_city text;
  v_address_state text;
  v_food_alerts text;
  v_member_count int := 0;
  v_detected_family_id text;
  v_person_family_id text;
  v_matched_profile_id uuid;
  v_matched_member_id uuid;
  v_distinct_family_count int;
  v_phone_family_distinct_count int;
  v_form_phones text[] := array[]::text[];
  v_family_id_from_phones text;
  v_allowed_relationships text[] := array[
    'Cônjuge', 'Filho(a)', 'Representante Legal', 'Pai', 'Mãe', 'Outros'
  ];
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('success', false, 'message', 'Payload inválido.');
  end if;

  v_informant := p_payload -> 'informant';

  if v_informant is null or jsonb_typeof(v_informant) <> 'object' then
    return jsonb_build_object('success', false, 'message', 'Informe os dados do representante legal.');
  end if;

  v_informant_name := nullif(trim(coalesce(v_informant ->> 'full_name', '')), '');

  if v_informant_name is null then
    return jsonb_build_object('success', false, 'message', 'Informe o nome do representante legal.');
  end if;

  begin
    v_informant_birth := nullif(trim(coalesce(v_informant ->> 'birth_date', '')), '')::date;
  exception
    when others then
      return jsonb_build_object('success', false, 'message', 'Data de nascimento do representante legal inválida.');
  end;

  v_phone := nullif(trim(coalesce(v_informant ->> 'phone', '')), '');

  if v_phone is null or not public.recepcao_is_valid_mobile_phone(v_phone) then
    return jsonb_build_object(
      'success', false,
      'message',
      'Verifique e corrija o celular do representante legal: informe exatamente 11 dígitos (DDD + número com 9 na frente, ex.: (11) 98765-4321).'
    );
  end if;

  v_cep := nullif(trim(coalesce(v_informant ->> 'cep', '')), '');
  v_address_number := nullif(trim(coalesce(v_informant ->> 'address_number', '')), '');
  v_address_complement := nullif(trim(coalesce(v_informant ->> 'address_complement', '')), '');
  v_address_street := nullif(trim(coalesce(v_informant ->> 'address_street', '')), '');
  v_address_neighborhood := nullif(trim(coalesce(v_informant ->> 'address_neighborhood', '')), '');
  v_address_city := nullif(trim(coalesce(v_informant ->> 'address_city', '')), '');
  v_address_state := nullif(trim(coalesce(v_informant ->> 'address_state', '')), '');
  v_food_alerts := nullif(trim(coalesce(v_informant ->> 'medical_food_alerts', '')), '');

  if v_phone is not null then
    v_form_phones := array_append(v_form_phones, v_phone);
  end if;

  for v_dependent in
    select value
      from jsonb_array_elements(coalesce(p_payload -> 'dependents', '[]'::jsonb))
  loop
    v_dependent_name := nullif(trim(coalesce(v_dependent ->> 'full_name', '')), '');

    if v_dependent_name is null then
      continue;
    end if;

    if nullif(trim(coalesce(v_dependent ->> 'phone', '')), '') is not null
       and not public.recepcao_is_valid_mobile_phone(v_dependent ->> 'phone') then
      return jsonb_build_object(
        'success', false,
        'message',
        format(
          'Verifique e corrija o celular do dependente "%s": informe exatamente 11 dígitos (DDD + número com 9 na frente, ex.: (11) 98765-4321).',
          v_dependent_name
        )
      );
    end if;

    if nullif(trim(coalesce(v_dependent ->> 'phone', '')), '') is not null then
      v_form_phones := array_append(
        v_form_phones,
        nullif(trim(coalesce(v_dependent ->> 'phone', '')), '')
      );
    end if;

    begin
      perform nullif(trim(coalesce(v_dependent ->> 'birth_date', '')), '')::date;
    exception
      when others then
        return jsonb_build_object(
          'success', false,
          'message',
          format('Data de nascimento inválida para o dependente "%s".', v_dependent_name)
        );
    end;

    v_relationship := nullif(trim(coalesce(v_dependent ->> 'relationship', '')), '');

    if v_relationship is null or not (v_relationship = any (v_allowed_relationships)) then
      return jsonb_build_object(
        'success', false,
        'message',
        format('Vínculo familiar inválido para o dependente "%s".', v_dependent_name)
      );
    end if;

    if v_relationship = 'Representante Legal' then
      return jsonb_build_object(
        'success', false,
        'message',
        'Apenas o informante pode ser Representante Legal.'
      );
    end if;
  end loop;

  insert into public.recepcao_cadastro_familiar_lote (status, member_count, tenant_id)
  values ('pending', 0,
    v_tenant)
  returning id into v_submission_id;

  select
    r.matched_profile_id,
    r.matched_member_id,
    r.detected_family_id
  into v_matched_profile_id, v_matched_member_id, v_person_family_id
  from public.resolve_family_id_for_recepcao_person(v_phone, v_informant_name) r;

  insert into public.recepcao_cadastro_familiar (
    submission_id,
    is_informant,
    full_name,
    birth_date,
    phone,
    relationship,
    cep,
    address_number,
    address_complement,
    address_street,
    address_neighborhood,
    address_city,
    address_state,
    medical_food_alerts,
    detected_family_id,
    matched_profile_id,
    matched_member_id, tenant_id) values (
    v_submission_id,
    true,
    v_informant_name,
    v_informant_birth,
    v_phone,
    'Representante Legal',
    v_cep,
    v_address_number,
    v_address_complement,
    v_address_street,
    v_address_neighborhood,
    v_address_city,
    v_address_state,
    v_food_alerts,
    v_person_family_id,
    v_matched_profile_id,
    v_matched_member_id,
    v_tenant);

  v_member_count := v_member_count + 1;

  for v_dependent in
    select value
      from jsonb_array_elements(coalesce(p_payload -> 'dependents', '[]'::jsonb))
  loop
    v_dependent_name := nullif(trim(coalesce(v_dependent ->> 'full_name', '')), '');

    if v_dependent_name is null then
      continue;
    end if;

    begin
      v_birth := nullif(trim(coalesce(v_dependent ->> 'birth_date', '')), '')::date;
    exception
      when others then
        return jsonb_build_object(
          'success', false,
          'message',
          format('Data de nascimento inválida para o dependente "%s".', v_dependent_name)
        );
    end;

    v_relationship := nullif(trim(coalesce(v_dependent ->> 'relationship', '')), '');
    v_phone := nullif(trim(coalesce(v_dependent ->> 'phone', '')), '');
    v_food_alerts := nullif(trim(coalesce(v_dependent ->> 'medical_food_alerts', '')), '');

    select
      r.matched_profile_id,
      r.matched_member_id,
      r.detected_family_id
    into v_matched_profile_id, v_matched_member_id, v_person_family_id
    from public.resolve_family_id_for_recepcao_person(v_phone, v_dependent_name) r;

    insert into public.recepcao_cadastro_familiar (
      submission_id,
      is_informant,
      full_name,
      birth_date,
      phone,
      relationship,
      cep,
      address_number,
      address_complement,
      address_street,
      address_neighborhood,
      address_city,
      address_state,
      medical_food_alerts,
      detected_family_id,
      matched_profile_id,
      matched_member_id, tenant_id) values (
      v_submission_id,
      false,
      v_dependent_name,
      v_birth,
      v_phone,
      v_relationship,
      v_cep,
      v_address_number,
      v_address_complement,
      v_address_street,
      v_address_neighborhood,
      v_address_city,
      v_address_state,
      v_food_alerts,
      v_person_family_id,
      v_matched_profile_id,
      v_matched_member_id,
    v_tenant);

    v_member_count := v_member_count + 1;
  end loop;

  v_family_id_from_phones := public.find_family_id_by_phones_in_profiles(v_form_phones);
  v_phone_family_distinct_count := public.count_distinct_family_ids_by_phones_in_profiles(v_form_phones);

  v_detected_family_id := public.resolve_recepcao_lote_family_id(v_submission_id);

  if v_detected_family_id is not null then
    update public.recepcao_cadastro_familiar
       set detected_family_id = v_detected_family_id
     where tenant_id = v_tenant
     and submission_id = v_submission_id;
  elsif v_family_id_from_phones is not null then
    update public.recepcao_cadastro_familiar
       set detected_family_id = v_family_id_from_phones
     where tenant_id = v_tenant
     and submission_id = v_submission_id;
    v_detected_family_id := v_family_id_from_phones;
  end if;

  select count(distinct nullif(trim(detected_family_id), ''))
    into v_distinct_family_count
    from public.recepcao_cadastro_familiar
   where tenant_id = v_tenant
    and submission_id = v_submission_id;

  select nullif(trim(detected_family_id), '')
    into v_detected_family_id
    from public.recepcao_cadastro_familiar
   where tenant_id = v_tenant
    and submission_id = v_submission_id
     and detected_family_id is not null
   order by is_informant desc, created_at
   limit 1;

  v_distinct_family_count := greatest(
    coalesce(v_distinct_family_count, 0),
    coalesce(v_phone_family_distinct_count, 0)
  );

  update public.recepcao_cadastro_familiar_lote
     set member_count = v_member_count,
         detected_family_id = coalesce(v_detected_family_id, v_family_id_from_phones),
         has_family_conflict = v_distinct_family_count > 1
   where tenant_id = v_tenant
     and id = v_submission_id;

  v_detected_family_id := coalesce(v_detected_family_id, v_family_id_from_phones);

  return jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'member_count', v_member_count,
    'detected_family_id', v_detected_family_id,
    'has_family_conflict', v_distinct_family_count > 1,
    'awaiting_review', true,
    'message',
      case
        when v_distinct_family_count > 1 then
          'Cadastro recebido. Há divergência de códigos familiares entre integrantes — a equipe analisará antes de gravar.'
        when v_detected_family_id is not null then
          format(
            'Cadastro recebido e aguardando análise. Código familiar detectado nas tabelas finais: %s.',
            v_detected_family_id
          )
        else
          'Cadastro recebido e aguardando análise da equipe antes de gravar nas tabelas finais.'
      end
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message',
      coalesce(sqlerrm, 'Não foi possível registrar o cadastro na recepção.')
    );
end;
$$;

grant execute on function public.submit_family_registration_public(jsonb) to anon;
grant execute on function public.submit_family_registration_public(jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- get_app_parameter_value
-- ---------------------------------------------------------------------------
create or replace function public.get_app_parameter_value(p_parameter text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_value text;
begin
  select ap.value
  into v_value
  from public.app_parameters ap
  where ap.tenant_id = v_tenant
    and  lower(trim(ap.parameter)) = lower(trim(p_parameter))
  order by
    case when ap.parameter = trim(p_parameter) then 0 else 1 end,
    ap.parameter
  limit 1;

  return v_value;
end;
$$;

grant execute on function public.get_app_parameter_value(text) to anon;
grant execute on function public.get_app_parameter_value(text) to authenticated;


-- ---------------------------------------------------------------------------
-- salvar_app_parameter_admin
-- ---------------------------------------------------------------------------
create or replace function public.salvar_app_parameter_admin(
  p_actor_profile_id uuid,
  p_parameter text,
  p_value text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_parameter text;
  v_value text;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_parameter := trim(coalesce(p_parameter, ''));
  v_value := trim(coalesce(p_value, ''));

  if v_parameter = '' then
    return jsonb_build_object('success', false, 'message', 'Parâmetro inválido.');
  end if;

  update public.app_parameters
     set value = v_value,
         parameter = v_parameter
   where tenant_id = v_tenant
     and lower(trim(parameter)) = lower(v_parameter);

  delete from public.app_parameters dup
   where dup.tenant_id = v_tenant
    and  lower(trim(dup.parameter)) = lower(v_parameter)
     and dup.ctid not in (
       select ap.ctid
         from public.app_parameters ap
        where ap.tenant_id = v_tenant
    and  lower(trim(ap.parameter)) = lower(v_parameter)
        order by
          case when ap.parameter = v_parameter then 0 else 1 end,
          ap.parameter
        limit 1
     );

  if not exists (
    select 1
      from public.app_parameters ap
     where lower(trim(ap.parameter)) = lower(v_parameter)
  ) then
    insert into public.app_parameters (parameter, value, tenant_id)
    values (v_parameter, v_value,
    v_tenant);
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Parâmetro salvo.',
    'parameter', v_parameter,
    'value', v_value
  );
exception
  when others then
    return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.salvar_app_parameter_admin(uuid, text, text) to anon, authenticated;


notify pgrst, 'reload schema';

commit;
