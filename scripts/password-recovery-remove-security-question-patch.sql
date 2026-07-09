-- Remove pergunta de segurança do fluxo de recuperação de senha (somente e-mail).
-- Execute no Supabase APÓS scripts/password-recovery-email-flow.sql

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
      'Recuperação bloqueada após tentativas incorretas. Tente novamente após '
        || coalesce(
          to_char(v_blocked_until at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
          '30 minutos'
        )
        || ' (horário de Brasília).',
      'blocked', true,
      'blocked_until', v_blocked_until
    );
  end if;

  select public.normalize_profile_email(p.email)
    into v_email
    from public.profiles p
   where p.id = v_profile_id;

  perform public.password_recovery_upsert_state(v_profile_id, p_phone);

  return jsonb_build_object(
    'ok', true,
    'needs_email', v_email is null,
    'email_masked', coalesce(public.mask_profile_email(v_email), '')
  );
end;
$$;

create or replace function public.password_recovery_send_pin(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_phone text;
  v_email text;
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
      'message', 'Recuperação temporariamente indisponível. Tente novamente em até 30 minutos.',
      'blocked', true
    );
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return public.password_recovery_generic_error();
  end if;

  select public.normalize_profile_email(p.email)
    into v_email
    from public.profiles p
   where p.id = v_profile_id;

  if v_email is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Cadastre um e-mail antes de recuperar a senha.'
    );
  end if;

  v_email_masked := public.mask_profile_email(v_email);
  perform public.password_recovery_upsert_state(v_profile_id, p_phone);

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

-- Compatibilidade com clientes antigos: ignora pergunta/resposta.
create or replace function public.password_recovery_verify_and_send_pin(
  p_phone text,
  p_answer text default null,
  p_question text default null
)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select public.password_recovery_send_pin(p_phone);
$$;

create or replace function public.password_recovery_verify_challenge_and_dispatch(
  p_phone text,
  p_answer text default null
)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select public.password_recovery_send_pin(p_phone);
$$;

grant execute on function public.password_recovery_get_state(text) to anon, authenticated;
grant execute on function public.password_recovery_send_pin(text) to anon, authenticated;
grant execute on function public.password_recovery_verify_and_send_pin(text, text, text) to anon, authenticated;
grant execute on function public.password_recovery_verify_challenge_and_dispatch(text, text) to anon, authenticated;
