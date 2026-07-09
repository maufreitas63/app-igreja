-- RPCs: envio de autorização pendente + confirmação via token.
-- Pré-requisito: media-authorization-schema.sql e password-recovery-email-flow.sql
--
-- app_parameters (opcional):
--   media_authorization_app_url = https://seu-dominio.pages.dev
--   media_authorization_email_function_url = https://REF.supabase.co/functions/v1/send-authorization-magic-link
--   media_authorization_email_function_secret = (secret)
--   media_authorization_pdf_function_url = https://REF.supabase.co/functions/v1/generate-authorization-pdf
--   media_authorization_pdf_function_secret = (secret)

alter table public.authorizations
  add column if not exists confirmation_token text null;

create unique index if not exists authorizations_confirmation_token_uidx
  on public.authorizations (confirmation_token)
  where confirmation_token is not null;

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
  select nullif(trim(public.get_app_parameter_value(p_parameter)), '');
$$;

create or replace function public.normalize_media_authorization_token(p_token text)
returns text
language sql
immutable
as $$
  select nullif(
    lower(substring(regexp_replace(coalesce(p_token, ''), '[^a-fA-F0-9]', '', 'g') from 1 for 64)),
    ''
  );
$$;

create or replace function public.media_authorization_confirm_email_subject()
returns text
language sql
immutable
as $$
  select 'Confirme sua autorizacao no app';
$$;

create or replace function public.media_authorization_confirm_email_text(
  p_full_name text,
  p_confirm_url text
)
returns text
language sql
immutable
as $$
  select
    'Olá, ' || trim(p_full_name) || E',\n\n'
    || 'Você solicitou confirmar a autorização de imagem e voz no aplicativo da igreja.' || E'\n\n'
    || 'Abra o link abaixo para concluir (válido por 48 horas):' || E'\n\n'
    || trim(p_confirm_url) || E'\n\n'
    || 'Se você não solicitou esta autorização, ignore este e-mail.';
$$;

create or replace function public.media_authorization_confirm_email_html(
  p_full_name text,
  p_confirm_url text
)
returns text
language sql
immutable
as $$
  select
    '<p>Olá, ' || replace(trim(p_full_name), '<', '&lt;') || ',</p>'
    || '<p>Você solicitou confirmar a autorização de imagem e voz no aplicativo da igreja.</p>'
    || '<p><a href="' || replace(trim(p_confirm_url), '"', '&quot;') || '">Confirmar autorização</a></p>'
    || '<p>Ou copie e cole este endereço no navegador:<br>'
    || replace(trim(p_confirm_url), '<', '&lt;') || '</p>'
    || '<p>Link válido por 48 horas. Se você não solicitou, ignore este e-mail.</p>';
$$;

-- Mesmo caminho HTTP do PIN (send_resend_transactional_email). Duplicado aqui para
-- reexecutar só media-authorization-rpc.sql sem quebrar o envio.
create or replace function public.send_resend_transactional_email(
  p_to_email text,
  p_subject text,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_api_key text;
  v_from text;
  v_body text;
  v_status integer;
  v_content text;
  v_recipient text;
  v_payload jsonb;
begin
  v_recipient := public.normalize_profile_email(p_to_email);

  v_api_key := nullif(trim(public.get_app_parameter_value('recovery_email_api_key')), '');
  v_from := nullif(trim(public.get_app_parameter_value('recovery_email_from')), '');

  if v_api_key is null or v_from is null then
    raise exception
      'Resend não configurado. Cadastre recovery_email_api_key e recovery_email_from em app_parameters.';
  end if;

  v_body := json_build_object(
    'from', v_from,
    'to', json_build_array(v_recipient),
    'subject', trim(p_subject),
    'text', p_text
  )::text;

  select p.p_status, p.p_content
    into v_status, v_content
    from public.password_recovery_http_post(
      'https://api.resend.com/emails',
      jsonb_build_object(
        'authorization', 'Bearer ' || v_api_key,
        'content-type', 'application/json'
      ),
      v_body
    ) as p;

  if coalesce(v_status, 0) not between 200 and 299 then
    raise exception
      'Não foi possível enviar o e-mail (HTTP %). %',
      coalesce(v_status, 0),
      coalesce(nullif(trim(v_content), ''), 'Verifique recovery_email_api_key e recovery_email_from no Resend.');
  end if;

  begin
    v_payload := v_content::jsonb;
  exception
    when others then
      v_payload := jsonb_build_object('raw', v_content);
  end;

  return jsonb_build_object(
    'ok', true,
    'provider', 'resend',
    'resendId', coalesce(v_payload->>'id', null),
    'to', v_recipient
  );
end;
$$;

create or replace function public.send_media_authorization_confirm_email_via_resend(
  p_to_email text,
  p_full_name text,
  p_confirm_url text
)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
begin
  return public.send_resend_transactional_email(
    p_to_email,
    public.media_authorization_confirm_email_subject(),
    public.media_authorization_confirm_email_text(p_full_name, p_confirm_url)
  );
end;
$$;

create or replace function public.send_media_authorization_confirm_email_via_gmail(
  p_to_email text,
  p_full_name text,
  p_confirm_url text
)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_smtp_user text;
  v_smtp_password text;
  v_from text;
  v_function_url text;
  v_function_secret text;
  v_body text;
  v_status integer;
  v_content text;
  v_recipient text;
  v_payload jsonb;
begin
  v_recipient := public.normalize_profile_email(p_to_email);

  v_smtp_user := public.get_app_parameter_value_trim('recovery_email_smtp_user');
  v_smtp_password := public.get_app_parameter_value_trim('recovery_email_smtp_password');
  v_from := public.get_app_parameter_value_trim('recovery_email_from');
  v_function_url := public.get_app_parameter_value_trim('recovery_email_function_url');
  v_function_secret := public.get_app_parameter_value_trim('recovery_email_function_secret');

  if v_smtp_user is null
     or v_smtp_password is null
     or v_from is null
     or v_function_url is null
     or v_function_secret is null then
    raise exception
      'Gmail não configurado. Cadastre recovery_email_smtp_user, recovery_email_smtp_password, recovery_email_from, recovery_email_function_url e recovery_email_function_secret em app_parameters.';
  end if;

  v_body := json_build_object(
    'secret', v_function_secret,
    'smtp_user', v_smtp_user,
    'smtp_password', v_smtp_password,
    'from', v_from,
    'to', v_recipient,
    'subject', public.media_authorization_confirm_email_subject(),
    'text', public.media_authorization_confirm_email_text(p_full_name, p_confirm_url)
  )::text;

  select p.p_status, p.p_content
    into v_status, v_content
    from public.password_recovery_http_post(
      v_function_url,
      jsonb_build_object('content-type', 'application/json'),
      v_body
    ) as p;

  if coalesce(v_status, 0) not between 200 and 299 then
    raise exception
      'Não foi possível acionar o envio Gmail (HTTP %). %',
      coalesce(v_status, 0),
      coalesce(nullif(trim(v_content), ''), 'Verifique a Edge Function send-password-recovery-email.');
  end if;

  begin
    v_payload := v_content::jsonb;
  exception
    when others then
      raise exception
        'Resposta inválida da Edge Function Gmail: %',
        coalesce(nullif(trim(v_content), ''), 'sem conteúdo');
  end;

  if coalesce(v_payload->>'ok', '') <> 'true' then
    raise exception
      'Não foi possível enviar o e-mail de autorização via Gmail. %',
      coalesce(nullif(trim(v_payload->>'message'), ''), v_content);
  end if;

  return jsonb_build_object(
    'ok', true,
    'provider', 'gmail',
    'to', v_recipient
  );
end;
$$;

create or replace function public.send_media_authorization_confirm_email(
  p_to_email text,
  p_full_name text,
  p_confirm_url text
)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_recipient text;
  v_provider text;
  v_has_gmail boolean;
  v_has_resend boolean;
  v_result jsonb;
begin
  v_recipient := public.normalize_profile_email(p_to_email);

  if v_recipient is null or not public.is_valid_profile_email(v_recipient) then
    raise exception 'E-mail inválido para envio.';
  end if;

  v_provider := lower(nullif(trim(public.get_app_parameter_value('recovery_email_provider')), ''));

  v_has_gmail :=
    nullif(trim(public.get_app_parameter_value('recovery_email_smtp_user')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_smtp_password')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_from')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_function_url')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_function_secret')), '') is not null;

  v_has_resend :=
    nullif(trim(public.get_app_parameter_value('recovery_email_api_key')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_from')), '') is not null;

  if v_provider is null then
    if v_has_gmail then
      v_provider := 'gmail';
    elsif v_has_resend then
      v_provider := 'resend';
    else
      raise exception
        'Envio de e-mail não configurado. Defina recovery_email_provider=gmail ou resend e os parâmetros correspondentes em app_parameters.';
    end if;
  end if;

  if v_provider = 'gmail' then
    v_result := public.send_media_authorization_confirm_email_via_gmail(p_to_email, p_full_name, p_confirm_url);
    return v_result;
  end if;

  if v_provider = 'resend' then
    v_result := public.send_media_authorization_confirm_email_via_resend(p_to_email, p_full_name, p_confirm_url);
    return v_result;
  end if;

  raise exception
    'recovery_email_provider inválido: %. Use gmail ou resend.',
    v_provider;
end;
$$;

create or replace function public.resolve_profile_id_for_media_authorization()
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
  end if;

  v_raw := nullif(trim(coalesce((v_headers::json ->> 'x-profile-id'), '')), '');

  if v_raw is null then
    return null;
  end if;

  begin
    v_profile_id := v_raw::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  if exists (select 1 from public.profiles p where p.id = v_profile_id) then
    return v_profile_id;
  end if;

  return null;
end;
$$;

create or replace function public.debug_media_authorization_submit_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers text;
  v_token text;
  v_profile_header text;
  v_provider text;
  v_has_resend boolean;
begin
  begin
    v_headers := current_setting('request.headers', true);
  exception
    when others then
      v_headers := null;
  end;

  if v_headers is not null and v_headers <> '' then
    v_token := nullif(trim(coalesce((v_headers::json ->> 'x-session-token'), '')), '');
    v_profile_header := nullif(trim(coalesce((v_headers::json ->> 'x-profile-id'), '')), '');
  end if;

  v_provider := lower(nullif(trim(public.get_app_parameter_value('recovery_email_provider')), ''));

  v_has_resend :=
    nullif(trim(public.get_app_parameter_value('recovery_email_api_key')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_from')), '') is not null;

  return jsonb_build_object(
    'tokenPresent', v_token is not null,
    'tokenValid', v_token is not null and public.resolve_profile_session_token(v_token) is not null,
    'profileIdHeader', v_profile_header,
    'resolvedProfileId', public.resolve_profile_id_for_media_authorization(),
    'currentSessionProfileId', public.current_session_profile_id(),
    'recoveryEmailProvider', v_provider,
    'hasResendConfig', v_has_resend
  );
end;
$$;

create or replace function public.ping_profile_session()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', public.resolve_profile_id_for_media_authorization() is not null,
    'profileId', public.resolve_profile_id_for_media_authorization(),
    'strictSessionOk', public.current_session_profile_id() is not null
  );
$$;

-- Único caminho de envio usado pelo submit e pelo teste 03 (mesma rota do 03b quando provider=resend).
create or replace function public.send_media_authorization_pending_email(
  p_to_email text,
  p_full_name text,
  p_confirm_url text
)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_recipient text;
  v_provider text;
  v_has_gmail boolean;
  v_has_resend boolean;
begin
  v_recipient := public.normalize_profile_email(p_to_email);

  if v_recipient is null or not public.is_valid_profile_email(v_recipient) then
    raise exception 'E-mail inválido para envio.';
  end if;

  v_provider := lower(nullif(trim(public.get_app_parameter_value('recovery_email_provider')), ''));

  v_has_gmail :=
    nullif(trim(public.get_app_parameter_value('recovery_email_smtp_user')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_smtp_password')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_from')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_function_url')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_function_secret')), '') is not null;

  v_has_resend :=
    nullif(trim(public.get_app_parameter_value('recovery_email_api_key')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_from')), '') is not null;

  if v_provider is null then
    if v_has_resend then
      v_provider := 'resend';
    elsif v_has_gmail then
      v_provider := 'gmail';
    else
      raise exception
        'Envio de e-mail não configurado. Defina recovery_email_provider=gmail ou resend e os parâmetros correspondentes em app_parameters.';
    end if;
  end if;

  if v_provider = 'gmail' then
    return public.send_media_authorization_confirm_email_via_gmail(p_to_email, p_full_name, p_confirm_url);
  end if;

  if v_has_resend then
    return public.send_resend_transactional_email(
      p_to_email,
      public.media_authorization_confirm_email_subject(),
      public.media_authorization_confirm_email_text(p_full_name, p_confirm_url)
    );
  end if;

  raise exception
    'recovery_email_provider inválido: %. Use gmail ou resend.',
    v_provider;
end;
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
  v_token text;
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
    return jsonb_build_object(
      'ok', true,
      'message', 'Autorização já confirmada com sucesso.',
      'authorizationId', v_authorization_id,
      'alreadyConfirmed', true
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
    confirmed_via_email,
    confirmation_token
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
    true,
    v_token
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

create or replace function public.test_media_authorization_email_delivery(
  p_email text,
  p_full_name text default 'Teste',
  p_confirm_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_test_token text;
begin
  v_test_token := encode(gen_random_bytes(32), 'hex');

  v_url := coalesce(
    nullif(trim(p_confirm_url), ''),
    coalesce(
      public.get_app_parameter_value_trim('media_authorization_app_url'),
      public.get_app_parameter_value_trim('app_public_url'),
      'https://localhost:8081'
    ) || '/autorizacao-midia-confirmar?token=' || v_test_token
  );

  return public.send_media_authorization_pending_email(
    lower(trim(p_email)),
    coalesce(nullif(trim(p_full_name), ''), 'Teste'),
    v_url
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'message', SQLERRM
    );
end;
$$;

grant execute on function public.resolve_profile_id_for_media_authorization() to anon, authenticated;
grant execute on function public.debug_media_authorization_submit_context() to anon, authenticated;
grant execute on function public.ping_profile_session() to anon, authenticated;
grant execute on function public.send_media_authorization_pending_email(text, text, text) to anon, authenticated;
grant execute on function public.normalize_media_authorization_token(text) to anon, authenticated;
grant execute on function public.send_media_authorization_confirm_email(text, text, text) to anon, authenticated;
grant execute on function public.test_media_authorization_email_delivery(text, text, text) to anon, authenticated;
grant execute on function public.submit_media_authorization_pending(text, text, text, text) to anon, authenticated;
grant execute on function public.confirm_media_authorization(text, text, text) to anon, authenticated;
grant execute on function public.media_authorization_terms_text() to anon, authenticated;
grant execute on function public.media_authorization_terms_hash() to anon, authenticated;
grant execute on function public.validate_cpf_digits(text) to anon, authenticated;

notify pgrst, 'reload schema';
