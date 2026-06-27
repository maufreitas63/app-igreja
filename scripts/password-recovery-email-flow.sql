-- Recuperação de senha por e-mail + pergunta de segurança (sem WhatsApp).
-- Execute no Supabase APÓS scripts/password-recovery-security.sql
--
-- Configure em app_parameters:
--   recovery_email_api_key  → chave Resend (re_...)
--   recovery_email_from     → ex.: "Igreja <noreply@seudominio.com>"
--
-- Extensão HTTP do Supabase (Database → Extensions → http) deve estar ativa.
-- Se der erro de tipo http_request, habilite a extensão no painel e reaplique este script.

create extension if not exists http with schema extensions;

create or replace function public.normalize_profile_email(p_email text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(p_email, ''))), '');
$$;

create or replace function public.is_valid_profile_email(p_email text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_email, '') ~* '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$';
$$;

create or replace function public.mask_profile_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or position('@' in p_email) <= 1 then null
    else left(split_part(p_email, '@', 1), 1)
      || '****@'
      || split_part(p_email, '@', 2)
  end;
$$;

create or replace function public.send_password_recovery_pin_email(
  p_to_email text,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_api_key text;
  v_from text;
  v_body text;
  v_status integer;
  v_content text;
  v_recipient text;
begin
  v_recipient := public.normalize_profile_email(p_to_email);

  if v_recipient is null or not public.is_valid_profile_email(v_recipient) then
    raise exception 'E-mail inválido para envio.';
  end if;

  v_api_key := nullif(trim(public.get_app_parameter_value('recovery_email_api_key')), '');
  v_from := nullif(trim(public.get_app_parameter_value('recovery_email_from')), '');

  if v_api_key is null or v_from is null then
    raise exception
      'Envio de e-mail não configurado. Cadastre recovery_email_api_key e recovery_email_from em app_parameters.';
  end if;

  v_body := json_build_object(
    'from', v_from,
    'to', json_build_array(v_recipient),
    'subject', 'Sua nova senha de acesso',
    'text',
      'Olá,' || E'\n\n'
      || 'Sua nova senha de acesso (4 dígitos) é: ' || p_pin || E'\n\n'
      || 'Use-a na tela de entrada do app.' || E'\n\n'
      || 'Se você não solicitou esta alteração, ignore este e-mail.'
  )::text;

  select r.status, r.content::text
    into v_status, v_content
    from http(
      (
        'POST',
        'https://api.resend.com/emails',
        array[
          http_header('authorization', 'Bearer ' || v_api_key),
          http_header('content-type', 'application/json')
        ],
        'application/json',
        v_body
      )::http_request
    ) as r(status, content_type, headers, content);

  if coalesce(v_status, 0) not between 200 and 299 then
    raise exception
      'Não foi possível enviar o e-mail de recuperação (HTTP %). %',
      coalesce(v_status, 0),
      coalesce(nullif(trim(v_content), ''), 'Verifique recovery_email_api_key, recovery_email_from e a extensão http.');
  end if;
end;
$$;

create or replace function public.password_recovery_get_state(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_phone text;
  v_email text;
  v_question text;
  v_hash text;
  v_blocked_until timestamptz;
begin
  v_phone := public.password_recovery_phone_key(p_phone);

  if v_phone is null or length(v_phone) < 10 then
    return public.password_recovery_generic_error();
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return public.password_recovery_generic_error();
  end if;

  if public.password_recovery_is_blocked(p_phone) then
    select s.blocked_until
      into v_blocked_until
      from public.password_recovery_state s
     where s.phone_normalized = v_phone;

    return jsonb_build_object(
      'ok', false,
      'message',
      'Recuperação bloqueada após 3 respostas incorretas. Tente novamente após '
        || coalesce(
          to_char(v_blocked_until at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
          '30 minutos'
        )
        || ' (horário de Brasília).',
      'blocked', true,
      'blocked_until', v_blocked_until
    );
  end if;

  select public.normalize_profile_email(p.email),
         nullif(trim(p.security_question), ''),
         nullif(trim(p.security_answer_hash), '')
    into v_email, v_question, v_hash
    from public.profiles p
   where p.id = v_profile_id;

  perform public.password_recovery_upsert_state(v_profile_id, p_phone);

  return jsonb_build_object(
    'ok', true,
    'needs_email', v_email is null,
    'email_masked', coalesce(public.mask_profile_email(v_email), ''),
    'has_security_question', v_question is not null and v_hash is not null,
    'security_question', coalesce(v_question, '')
  );
end;
$$;

create or replace function public.password_recovery_set_email(
  p_phone text,
  p_email text,
  p_email_confirm text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_phone text;
  v_current_email text;
  v_email text;
  v_confirm text;
begin
  v_phone := public.password_recovery_phone_key(p_phone);

  if v_phone is null or length(v_phone) < 10 then
    return public.password_recovery_generic_error();
  end if;

  if public.password_recovery_is_blocked(p_phone) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Recuperação temporariamente indisponível.',
      'blocked', true
    );
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return public.password_recovery_generic_error();
  end if;

  select public.normalize_profile_email(p.email)
    into v_current_email
    from public.profiles p
   where p.id = v_profile_id;

  if v_current_email is not null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Este perfil já possui e-mail cadastrado.'
    );
  end if;

  v_email := public.normalize_profile_email(p_email);
  v_confirm := public.normalize_profile_email(p_email_confirm);

  if v_email is null or v_confirm is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Informe o e-mail e a confirmação.'
    );
  end if;

  if v_email <> v_confirm then
    return jsonb_build_object(
      'ok', false,
      'message', 'Os e-mails informados não conferem. Digite novamente.'
    );
  end if;

  if not public.is_valid_profile_email(v_email) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Informe um e-mail válido.'
    );
  end if;

  update public.profiles p
     set email = v_email,
         updated_at = now()
   where p.id = v_profile_id;

  return jsonb_build_object(
    'ok', true,
    'email_masked', public.mask_profile_email(v_email)
  );
end;
$$;

create or replace function public.password_recovery_verify_and_send_pin(
  p_phone text,
  p_answer text,
  p_question text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_phone text;
  v_email text;
  v_question text;
  v_hash text;
  v_new_question text;
  v_new_answer text;
  v_attempts integer;
  v_state public.password_recovery_state;
  v_pin text;
  v_email_masked text;
begin
  v_phone := public.password_recovery_phone_key(p_phone);

  if v_phone is null or length(v_phone) < 10 then
    return public.password_recovery_generic_error();
  end if;

  if public.password_recovery_is_blocked(p_phone) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Recuperação bloqueada por 30 minutos após tentativas incorretas.',
      'blocked', true
    );
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return public.password_recovery_generic_error();
  end if;

  select public.normalize_profile_email(p.email),
         nullif(trim(p.security_question), ''),
         nullif(trim(p.security_answer_hash), '')
    into v_email, v_question, v_hash
    from public.profiles p
   where p.id = v_profile_id;

  if v_email is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Cadastre um e-mail antes de recuperar a senha.'
    );
  end if;

  v_email_masked := public.mask_profile_email(v_email);
  v_state := public.password_recovery_upsert_state(v_profile_id, p_phone);

  if v_hash is null then
    v_new_question := trim(coalesce(p_question, ''));

    if char_length(v_new_question) < 5 then
      return jsonb_build_object(
        'ok', false,
        'message', 'Cadastre uma pergunta de segurança com pelo menos 5 caracteres.'
      );
    end if;

    v_new_answer := public.normalize_security_answer(p_answer);

    if char_length(v_new_answer) < 2 then
      return jsonb_build_object(
        'ok', false,
        'message', 'Informe uma resposta de segurança com pelo menos 2 caracteres.'
      );
    end if;

    update public.profiles p
       set security_question = v_new_question,
           security_answer_hash = crypt(v_new_answer, gen_salt('bf', 10)),
           updated_at = now()
     where p.id = v_profile_id;
  else
    if public.normalize_security_answer(p_answer) = '' then
      return jsonb_build_object(
        'ok', false,
        'message', 'Informe a resposta da pergunta de segurança.'
      );
    end if;

    if not public.security_answer_matches(p_answer, v_hash) then
      if public.password_recovery_is_lockout_exempt(v_profile_id) then
        return jsonb_build_object(
          'ok', false,
          'message', 'Resposta incorreta.'
        );
      end if;

      v_attempts := coalesce(v_state.failed_challenge_attempts, 0) + 1;

      if v_attempts >= 3 then
        update public.password_recovery_state s
           set failed_challenge_attempts = v_attempts,
               blocked_until = now() + interval '30 minutes',
               challenge_passed_at = null,
               updated_at = now()
         where s.phone_normalized = v_phone;

        return jsonb_build_object(
          'ok', false,
          'message', 'Recuperação bloqueada por 30 minutos após 3 tentativas incorretas.',
          'blocked', true,
          'attempts_remaining', 0
        );
      end if;

      update public.password_recovery_state s
         set failed_challenge_attempts = v_attempts,
             challenge_passed_at = null,
             updated_at = now()
       where s.phone_normalized = v_phone;

      return jsonb_build_object(
        'ok', false,
        'message', 'Resposta incorreta.',
        'attempts_remaining', greatest(0, 3 - v_attempts)
      );
    end if;
  end if;

  update public.password_recovery_state s
     set failed_challenge_attempts = 0,
         blocked_until = null,
         updated_at = now()
   where s.phone_normalized = v_phone;

  v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');

  update public.profiles p
     set access_pin = v_pin,
         updated_at = now()
   where p.id = v_profile_id;

  perform public.send_password_recovery_pin_email(v_email, v_pin);

  return jsonb_build_object(
    'ok', true,
    'message', 'Enviamos a nova senha para ' || v_email_masked || '.',
    'email_masked', v_email_masked
  );
end;
$$;

-- Substitui fluxo antigo (WhatsApp) por e-mail.
create or replace function public.password_recovery_verify_challenge_and_dispatch(
  p_phone text,
  p_answer text
)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select public.password_recovery_verify_and_send_pin(p_phone, p_answer, null);
$$;

grant execute on function public.password_recovery_get_state(text) to anon, authenticated;
grant execute on function public.password_recovery_set_email(text, text, text) to anon, authenticated;
grant execute on function public.password_recovery_verify_and_send_pin(text, text, text) to anon, authenticated;
