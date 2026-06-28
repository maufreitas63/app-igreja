-- Corrige gravação de pergunta/resposta na recuperação de senha.
-- Problema: perfil com security_answer_hash sem security_question entrava no modo
-- "validar resposta" e ignorava a pergunta digitada na tela.
-- Execute no Supabase (após password-recovery-email-flow.sql).

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

  if v_question is null or v_hash is null then
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

    if not found then
      return jsonb_build_object(
        'ok', false,
        'message', 'Não foi possível salvar a pergunta de segurança no perfil.'
      );
    end if;
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

-- Diagnóstico: perfis com hash sem pergunta (causa comum do bug)
-- select id, phone, email, security_question, left(security_answer_hash, 20) as hash_prefix
-- from profiles
-- where nullif(trim(security_answer_hash), '') is not null
--   and nullif(trim(security_question), '') is null;
