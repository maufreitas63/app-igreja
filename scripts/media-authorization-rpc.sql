-- RPCs: envio de autorização pendente + confirmação via token.
-- Pré-requisito: media-authorization-schema.sql e password-recovery-email-flow.sql
--
-- app_parameters (opcional):
--   media_authorization_app_url = https://seu-dominio.pages.dev
--   media_authorization_email_function_url = https://REF.supabase.co/functions/v1/send-authorization-magic-link
--   media_authorization_email_function_secret = (secret)
--   media_authorization_pdf_function_url = https://REF.supabase.co/functions/v1/generate-authorization-pdf
--   media_authorization_pdf_function_secret = (secret)

create or replace function public.media_authorization_terms_text()
returns text
language sql
immutable
as $$
  select
    'Autorização para uso de imagem e voz: Declaro estar ciente de que os cultos, celebrações, eventos e demais atividades promovidas pela igreja poderão ser fotografados, filmados e transmitidos pelos seus canais oficiais. Na qualidade de participante e de responsável legal pelos menores de idade vinculados ao meu cadastro familiar, autorizo a captação e a utilização da minha imagem e voz, bem como da imagem e voz desses menores, para fins institucionais, educativos, históricos e de divulgação das atividades da igreja, em mídias impressas, digitais, redes sociais, transmissões ao vivo e demais canais oficiais, sem qualquer ônus, observadas a legislação aplicável, especialmente a Lei nº 13.709/2018 (LGPD), e o respeito à honra, à dignidade e à privacidade dos envolvidos.';
$$;

create or replace function public.media_authorization_terms_hash()
returns text
language sql
immutable
as $$
  select encode(digest(public.media_authorization_terms_text(), 'sha256'), 'hex');
$$;

create or replace function public.get_app_parameter_value_trim(p_parameter text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(value), '')
    from public.app_parameters
   where lower(trim(parameter)) = lower(trim(p_parameter))
   limit 1;
$$;

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
  v_profile_id uuid;
  v_token text;
  v_pending_id uuid;
  v_app_url text;
  v_function_url text;
  v_function_secret text;
  v_confirm_url text;
  v_status integer;
  v_content text;
  v_body jsonb;
begin
  v_profile_id := public.current_session_profile_id();

  if v_profile_id is null then
    return jsonb_build_object('ok', false, 'message', 'Faça login para enviar a autorização.');
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
   where profile_id = v_profile_id;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.pending_authorizations (
    profile_id,
    full_name,
    email,
    cpf,
    phone,
    token,
    privacy_policy_version
  )
  values (
    v_profile_id,
    trim(p_full_name),
    lower(trim(p_email)),
    public.normalize_cpf_digits(p_cpf),
    trim(p_phone),
    v_token,
    '1.0'
  )
  returning id into v_pending_id;

  v_app_url := coalesce(
    public.get_app_parameter_value_trim('media_authorization_app_url'),
    public.get_app_parameter_value_trim('app_public_url'),
  'https://localhost:8081');

  v_function_url := public.get_app_parameter_value_trim('media_authorization_email_function_url');
  v_function_secret := public.get_app_parameter_value_trim('media_authorization_email_function_secret');

  v_confirm_url := rtrim(v_app_url, '/') || '/autorizacao-midia-confirmar?token=' || v_token;

  if v_function_url is not null and v_function_secret is not null then
    v_body := jsonb_build_object(
      'to', lower(trim(p_email)),
      'confirmUrl', v_confirm_url,
      'fullName', trim(p_full_name),
      'secret', v_function_secret
    );

    select p_status, p_content
      into v_status, v_content
      from public.password_recovery_http_post(
        v_function_url,
        jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_function_secret),
        v_body::text
      );

    if coalesce(v_status, 0) < 200 or coalesce(v_status, 0) >= 300 then
      delete from public.pending_authorizations where id = v_pending_id;
      return jsonb_build_object(
        'ok', false,
        'message', 'Não foi possível enviar o e-mail de confirmação. Tente novamente.'
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Enviamos um link de confirmação para o seu e-mail. Abra-o para concluir a autorização.',
    'pendingId', v_pending_id,
    'emailMasked', public.mask_profile_email(lower(trim(p_email))),
    'devConfirmUrl', case when v_function_url is null then v_confirm_url else null end
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'message', SQLERRM);
end;
$$;

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
  v_pending public.pending_authorizations%rowtype;
  v_authorization_id uuid;
  v_pdf_function_url text;
  v_pdf_function_secret text;
  v_status integer;
  v_content text;
  v_body jsonb;
  v_storage_path text;
begin
  if coalesce(trim(p_token), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Token inválido.');
  end if;

  select *
    into v_pending
    from public.pending_authorizations
   where token = trim(p_token)
   limit 1;

  if v_pending.id is null then
    return jsonb_build_object('ok', false, 'message', 'Link inválido ou já utilizado.');
  end if;

  if v_pending.expires_at < now() then
    delete from public.pending_authorizations where id = v_pending.id;
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
    confirmed_via_email
  )
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
    true
  )
  returning id into v_authorization_id;

  delete from public.pending_authorizations where id = v_pending.id;

  v_pdf_function_url := public.get_app_parameter_value_trim('media_authorization_pdf_function_url');
  v_pdf_function_secret := public.get_app_parameter_value_trim('media_authorization_pdf_function_secret');

  if v_pdf_function_url is not null and v_pdf_function_secret is not null then
    v_body := jsonb_build_object(
      'authorizationId', v_authorization_id,
      'secret', v_pdf_function_secret
    );

    select p_status, p_content
      into v_status, v_content
      from public.password_recovery_http_post(
        v_pdf_function_url,
        jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_pdf_function_secret),
        v_body::text
      );

    if coalesce(v_status, 0) >= 200 and coalesce(v_status, 0) < 300 then
      begin
        v_storage_path := (v_content::jsonb ->> 'storagePath');
        if v_storage_path is not null then
          update public.authorizations
             set storage_path = v_storage_path
           where id = v_authorization_id;
        end if;
      exception when others then
        null;
      end;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Autorização confirmada com sucesso.',
    'authorizationId', v_authorization_id
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'message', SQLERRM);
end;
$$;

grant execute on function public.submit_media_authorization_pending(text, text, text, text) to anon, authenticated;
grant execute on function public.confirm_media_authorization(text, text, text) to anon, authenticated;
grant execute on function public.media_authorization_terms_text() to anon, authenticated;
grant execute on function public.media_authorization_terms_hash() to anon, authenticated;
grant execute on function public.validate_cpf_digits(text) to anon, authenticated;

notify pgrst, 'reload schema';
