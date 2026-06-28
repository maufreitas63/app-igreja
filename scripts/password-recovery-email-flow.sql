-- Recuperação de senha por e-mail + pergunta de segurança (sem WhatsApp).
-- Execute no Supabase APÓS scripts/password-recovery-security.sql
--
-- Provedor de e-mail (app_parameters.recovery_email_provider):
--   gmail  → Gmail SMTP via Edge Function (sem domínio próprio)
--   resend → API Resend (requer domínio verificado para enviar a qualquer destinatário)
--
-- === Gmail (recomendado sem domínio) ===
-- 1. Google Account → Segurança → Verificação em 2 etapas → Senhas de app
-- 2. Deploy da Edge Function (uma vez):
--      supabase login
--      supabase link --project-ref SEU_PROJECT_REF
--      supabase secrets set RECOVERY_EMAIL_FUNCTION_SECRET=uma-chave-longa-aleatoria
--      supabase functions deploy send-password-recovery-email --no-verify-jwt
-- 3. app_parameters:
--      recovery_email_provider          = gmail
--      recovery_email_function_url      = https://SEU_REF.supabase.co/functions/v1/send-password-recovery-email
--      recovery_email_function_secret   = (mesmo valor do secret acima)
--      recovery_email_smtp_user         = ibnmassagua@gmail.com
--      recovery_email_smtp_password     = senha de app do Google (16 caracteres)
--      recovery_email_from              = Igreja IBN <ibnmassagua@gmail.com>
--
-- === Resend (produção com domínio ibnorte.api.br) ===
--      recovery_email_provider          = resend
--      recovery_email_api_key           = re_...
--      recovery_email_from              = Igreja IBN Norte <nao-responda@ibnorte.api.br>
--      Ver scripts/password-recovery-email-ibnorte-resend-setup.sql
--
-- Extensão http do Supabase (Database → Extensions → http) deve estar ativa.

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

create or replace function public.password_recovery_pin_email_text(p_pin text)
returns text
language sql
immutable
as $$
  select
    'Olá,' || E'\n\n'
    || 'Sua nova senha de acesso (4 dígitos) é: ' || p_pin || E'\n\n'
    || 'Use-a na tela de entrada do app.' || E'\n\n'
    || 'Se você não solicitou esta alteração, ignore este e-mail.';
$$;

create or replace function public.password_recovery_resolve_http_schema()
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select n.nspname
    from pg_catalog.pg_type t
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
   where t.typname = 'http_request'
   order by case
     when n.nspname = 'http' then 0
     when n.nspname = 'extensions' then 1
     when n.nspname = 'public' then 2
     else 3
   end
   limit 1;
$$;

create or replace function public.password_recovery_http_post(
  p_url text,
  p_headers jsonb,
  p_body text,
  out p_status integer,
  out p_content text
)
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_http_schema text;
  v_sql text;
  v_header record;
  v_header_sql text := '';
  v_i integer := 0;
begin
  v_http_schema := public.password_recovery_resolve_http_schema();

  if v_http_schema is null then
    raise exception
      'Extensão http não instalada. No Supabase: Database → Extensions → habilite ''http''.';
  end if;

  for v_header in
    select e.key, e.value
      from jsonb_each_text(coalesce(p_headers, '{}'::jsonb)) as e(key, value)
  loop
    v_i := v_i + 1;
    v_header_sql := v_header_sql || format(
      E',\n          %I.http_header(%L, %L)',
      v_http_schema,
      v_header.key,
      v_header.value
    );
  end loop;

  if v_i = 0 then
    raise exception 'password_recovery_http_post exige ao menos um header HTTP.';
  end if;

  v_header_sql := substring(v_header_sql from 2);

  v_sql := format(
    $sql$
    select r.status, r.content::text
      from %1$I.http((
        'POST',
        %2$L,
        array[
          %3$s
        ],
        'application/json',
        %4$L
      )::%1$I.http_request) as r(status, content_type, headers, content)
    $sql$,
    v_http_schema,
    p_url,
    v_header_sql,
    p_body
  );

  execute v_sql into p_status, p_content;
end;
$$;

create or replace function public.send_password_recovery_pin_email_via_resend(
  p_to_email text,
  p_pin text
)
returns void
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
    'subject', 'Sua nova senha de acesso',
    'text', public.password_recovery_pin_email_text(p_pin)
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
      'Não foi possível enviar o e-mail de recuperação (HTTP %). %',
      coalesce(v_status, 0),
      coalesce(nullif(trim(v_content), ''), 'Verifique recovery_email_api_key e recovery_email_from no Resend.');
  end if;
end;
$$;

create or replace function public.send_password_recovery_pin_email_via_gmail(
  p_to_email text,
  p_pin text
)
returns void
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

  v_smtp_user := nullif(trim(public.get_app_parameter_value('recovery_email_smtp_user')), '');
  v_smtp_password := nullif(trim(public.get_app_parameter_value('recovery_email_smtp_password')), '');
  v_from := nullif(trim(public.get_app_parameter_value('recovery_email_from')), '');
  v_function_url := nullif(trim(public.get_app_parameter_value('recovery_email_function_url')), '');
  v_function_secret := nullif(trim(public.get_app_parameter_value('recovery_email_function_secret')), '');

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
    'subject', 'Sua nova senha de acesso',
    'text', public.password_recovery_pin_email_text(p_pin)
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
      coalesce(nullif(trim(v_content), ''), 'Verifique a Edge Function send-password-recovery-email e os parâmetros Gmail.');
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
      'Não foi possível enviar o e-mail de recuperação via Gmail. %',
      coalesce(nullif(trim(v_payload->>'message'), ''), v_content);
  end if;
end;
$$;

create or replace function public.send_password_recovery_pin_email(
  p_to_email text,
  p_pin text
)
returns void
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
    perform public.send_password_recovery_pin_email_via_gmail(p_to_email, p_pin);
    return;
  end if;

  if v_provider = 'resend' then
    perform public.send_password_recovery_pin_email_via_resend(p_to_email, p_pin);
    return;
  end if;

  raise exception
    'recovery_email_provider inválido: %. Use gmail ou resend.',
    v_provider;
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
