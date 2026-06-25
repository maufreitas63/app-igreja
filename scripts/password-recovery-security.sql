-- Recuperação de senha com pergunta de segurança + token WhatsApp (4 dígitos).
-- Ordem: identificar celular → desafio (hash) → disparo do token → redefinir access_pin.
-- Execute no SQL Editor do Supabase após profiles-access-pin.sql e access-control-security-hardening.sql.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

alter table public.profiles
  add column if not exists security_question text;

alter table public.profiles
  add column if not exists security_answer_hash text;

create table if not exists public.password_recovery_state (
  phone_normalized text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  failed_challenge_attempts integer not null default 0,
  blocked_until timestamptz null,
  challenge_passed_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists password_recovery_state_profile_idx
  on public.password_recovery_state (profile_id);

create table if not exists public.password_recovery_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  phone_normalized text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists password_recovery_tokens_phone_idx
  on public.password_recovery_tokens (phone_normalized, created_at desc);

alter table public.password_recovery_state enable row level security;
alter table public.password_recovery_tokens enable row level security;

create or replace function public.normalize_security_answer_legacy(p_answer text)
returns text
language sql
immutable
as $$
  select lower(
    trim(
      regexp_replace(
        regexp_replace(
          coalesce(p_answer, ''),
          E'[\\u200b\\u200c\\u200d\\ufeff]',
          '',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    )
  );
$$;

create or replace function public.normalize_security_answer(p_answer text)
returns text
language sql
immutable
as $$
  select lower(
    trim(
      regexp_replace(
        regexp_replace(
          extensions.unaccent(coalesce(p_answer, '')),
          E'[\\u200b\\u200c\\u200d\\ufeff]',
          '',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    )
  );
$$;

create or replace function public.security_answer_hash_is_bcrypt(p_hash text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_hash, '') ~ '^\$2[aby]\$';
$$;

create or replace function public.security_answer_matches(p_answer text, p_hash text)
returns boolean
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_norm text;
  v_norm_legacy text;
begin
  v_hash := nullif(trim(coalesce(p_hash, '')), '');

  if v_hash is null then
    return false;
  end if;

  v_norm := public.normalize_security_answer(p_answer);
  v_norm_legacy := public.normalize_security_answer_legacy(p_answer);

  if v_norm = '' and v_norm_legacy = '' then
    return false;
  end if;

  if public.security_answer_hash_is_bcrypt(v_hash) then
    return crypt(v_norm, v_hash) = v_hash
        or crypt(v_norm_legacy, v_hash) = v_hash;
  end if;

  -- Cadastro manual com texto puro em security_answer_hash (sem bcrypt).
  return v_norm = public.normalize_security_answer(v_hash)
      or v_norm = public.normalize_security_answer_legacy(v_hash)
      or v_norm_legacy = public.normalize_security_answer(v_hash)
      or v_norm_legacy = public.normalize_security_answer_legacy(v_hash);
end;
$$;

create or replace function public.password_recovery_phone_key(p_phone text)
returns text
language sql
stable
as $$
  select public.normalize_profile_phone(p_phone);
$$;

create or replace function public.find_profile_id_for_password_recovery(p_phone text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_digits text;
  v_local text;
  v_id uuid;
begin
  v_digits := public.normalize_profile_phone(p_phone);

  if v_digits is null then
    return null;
  end if;

  if v_digits like '55%' and length(v_digits) >= 12 then
    v_local := substring(v_digits from 3);
  else
    v_local := v_digits;
  end if;

  select p.id
    into v_id
    from public.profiles p
   where (
      public.normalize_profile_phone(p.phone) = v_digits
      or public.normalize_profile_phone(p.phone) = v_local
      or public.normalize_profile_phone(p.phone) = '55' || v_local
      or p.phone = trim(coalesce(p_phone, ''))
   )
   and nullif(trim(p.security_question), '') is not null
   and nullif(trim(p.security_answer_hash), '') is not null
   order by p.updated_at desc nulls last
   limit 1;

  return v_id;
end;
$$;

create or replace function public.password_recovery_generic_error()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'ok', false,
    'message', 'Dados não localizados'
  );
$$;

create or replace function public.password_recovery_is_lockout_exempt(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_profile_id is not null
     and public.is_super_admin_profile(p_profile_id);
$$;

create or replace function public.password_recovery_is_blocked(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text;
  v_profile_id uuid;
  v_blocked_until timestamptz;
begin
  v_phone := public.password_recovery_phone_key(p_phone);

  if v_phone is null then
    return false;
  end if;

  v_profile_id := coalesce(
    public.find_profile_id_for_password_recovery(p_phone),
    public.find_profile_id_by_phone(p_phone)
  );

  if public.password_recovery_is_lockout_exempt(v_profile_id) then
    update public.password_recovery_state s
       set failed_challenge_attempts = 0,
           blocked_until = null,
           updated_at = now()
     where s.phone_normalized = v_phone;

    return false;
  end if;

  select s.blocked_until
    into v_blocked_until
    from public.password_recovery_state s
   where s.phone_normalized = v_phone;

  return v_blocked_until is not null and v_blocked_until > now();
end;
$$;

create or replace function public.password_recovery_upsert_state(
  p_profile_id uuid,
  p_phone text
)
returns public.password_recovery_state
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text;
  v_row public.password_recovery_state;
begin
  v_phone := public.password_recovery_phone_key(p_phone);

  insert into public.password_recovery_state as s (
    phone_normalized,
    profile_id,
    failed_challenge_attempts,
    blocked_until,
    challenge_passed_at,
    updated_at
  )
  values (v_phone, p_profile_id, 0, null, null, now())
  on conflict (phone_normalized) do update
    set profile_id = excluded.profile_id,
        updated_at = now()
  returning *
    into v_row;

  return v_row;
end;
$$;

create or replace function public.password_recovery_identify(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_phone text;
  v_question text;
  v_hash text;
  v_blocked_until timestamptz;
begin
  v_phone := public.password_recovery_phone_key(p_phone);

  if v_phone is null or length(v_phone) < 10 then
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

  v_profile_id := public.find_profile_id_for_password_recovery(p_phone);

  if v_profile_id is null then
    if public.find_profile_id_by_phone(p_phone) is not null then
      return jsonb_build_object(
        'ok', false,
        'message',
        'Pergunta de segurança não cadastrada. Salve pergunta e resposta em Dados Cadastrais antes de recuperar a senha.',
        'needs_security_setup', true
      );
    end if;

    return public.password_recovery_generic_error();
  end if;

  select nullif(trim(p.security_question), ''),
         nullif(trim(p.security_answer_hash), '')
    into v_question, v_hash
    from public.profiles p
   where p.id = v_profile_id;

  if v_question is null or v_hash is null then
    return public.password_recovery_generic_error();
  end if;

  perform public.password_recovery_upsert_state(v_profile_id, p_phone);

  update public.password_recovery_state s
     set challenge_passed_at = null,
         updated_at = now()
   where s.phone_normalized = v_phone;

  return jsonb_build_object(
    'ok', true,
    'security_question', v_question
  );
end;
$$;

create or replace function public.password_recovery_verify_challenge(
  p_phone text,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_phone text;
  v_hash text;
  v_normalized_answer text;
  v_attempts integer;
  v_state public.password_recovery_state;
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

  v_profile_id := public.find_profile_id_for_password_recovery(p_phone);

  if v_profile_id is null then
    return public.password_recovery_generic_error();
  end if;

  select nullif(trim(p.security_answer_hash), '')
    into v_hash
    from public.profiles p
   where p.id = v_profile_id;

  if v_hash is null then
    return public.password_recovery_generic_error();
  end if;

  v_normalized_answer := public.normalize_security_answer(p_answer);

  if v_normalized_answer = '' then
    return jsonb_build_object(
      'ok', false,
      'message', 'Informe a resposta da pergunta de segurança.'
    );
  end if;

  v_state := public.password_recovery_upsert_state(v_profile_id, p_phone);

  if public.security_answer_matches(p_answer, v_hash) then
    update public.password_recovery_state s
       set failed_challenge_attempts = 0,
           blocked_until = null,
           challenge_passed_at = now(),
           updated_at = now()
     where s.phone_normalized = v_phone;

    return jsonb_build_object(
      'ok', true,
      'message', 'Desafio Superado'
    );
  end if;

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
end;
$$;

create or replace function public.password_recovery_dispatch_token(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_phone text;
  v_state public.password_recovery_state;
  v_token text;
  v_token_hash text;
  v_psw_user text;
  v_send_to_user boolean;
  v_recipient_digits text;
  v_manager_digits text;
  v_message text;
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

  v_profile_id := public.find_profile_id_for_password_recovery(p_phone);

  if v_profile_id is null then
    return public.password_recovery_generic_error();
  end if;

  select s.*
    into v_state
    from public.password_recovery_state s
   where s.phone_normalized = v_phone;

  if v_state.phone_normalized is null
     or v_state.profile_id is distinct from v_profile_id
     or v_state.challenge_passed_at is null
     or v_state.challenge_passed_at < now() - interval '10 minutes' then
    return jsonb_build_object(
      'ok', false,
      'message', 'Valide a pergunta de segurança antes de solicitar o código.'
    );
  end if;

  v_token := lpad((floor(random() * 10000))::int::text, 4, '0');
  v_token_hash := crypt(v_token, gen_salt('bf', 8));

  update public.password_recovery_tokens t
     set used_at = now()
   where t.phone_normalized = v_phone
     and t.used_at is null;

  insert into public.password_recovery_tokens (
    profile_id,
    phone_normalized,
    token_hash,
    expires_at
  )
  values (
    v_profile_id,
    v_phone,
    v_token_hash,
    now() + interval '5 minutes'
  );

  update public.password_recovery_state s
     set challenge_passed_at = null,
         updated_at = now()
   where s.phone_normalized = v_phone;

  v_psw_user := public.get_app_parameter_value('psw_user');

  v_send_to_user := lower(trim(coalesce(v_psw_user, ''))) in ('sim', 's', 'yes', 'y', '1', 'true', 'verdadeiro');

  if v_send_to_user then
    v_recipient_digits := v_phone;
    v_message :=
      'Seu código de recuperação de senha é: ' || v_token
      || '. Válido por 5 minutos. Informe-o no app para definir uma nova senha.';
  else
    v_manager_digits := public.get_app_parameter_value('psw_mngr');

    v_recipient_digits := nullif(regexp_replace(coalesce(v_manager_digits, ''), '\D', '', 'g'), '');

    if v_recipient_digits is null then
      return jsonb_build_object(
        'ok', false,
        'message', 'Destino do WhatsApp não configurado (psw_mngr).'
      );
    end if;

    v_message :=
      'Código de recuperação de senha para o celular ' || v_phone || ': ' || v_token
      || '. Válido por 5 minutos.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Código gerado.',
    'whatsapp_message', v_message,
    'recipient_digits', v_recipient_digits,
    'send_to_user', v_send_to_user
  );
end;
$$;

create or replace function public.password_recovery_verify_challenge_and_dispatch(
  p_phone text,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_phone text;
  v_hash text;
  v_normalized_answer text;
  v_attempts integer;
  v_state public.password_recovery_state;
  v_token text;
  v_token_hash text;
  v_psw_user text;
  v_send_to_user boolean;
  v_recipient_digits text;
  v_manager_digits text;
  v_message text;
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

  v_profile_id := public.find_profile_id_for_password_recovery(p_phone);

  if v_profile_id is null then
    return public.password_recovery_generic_error();
  end if;

  select nullif(trim(p.security_answer_hash), '')
    into v_hash
    from public.profiles p
   where p.id = v_profile_id;

  if v_hash is null then
    return public.password_recovery_generic_error();
  end if;

  v_normalized_answer := public.normalize_security_answer(p_answer);

  if v_normalized_answer = '' then
    return jsonb_build_object(
      'ok', false,
      'message', 'Informe a resposta da pergunta de segurança.'
    );
  end if;

  v_state := public.password_recovery_upsert_state(v_profile_id, p_phone);

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

  update public.password_recovery_state s
     set failed_challenge_attempts = 0,
         blocked_until = null,
         challenge_passed_at = now(),
         updated_at = now()
   where s.phone_normalized = v_phone;

  v_token := lpad((floor(random() * 10000))::int::text, 4, '0');
  v_token_hash := crypt(v_token, gen_salt('bf', 8));

  update public.password_recovery_tokens t
     set used_at = now()
   where t.phone_normalized = v_phone
     and t.used_at is null;

  insert into public.password_recovery_tokens (
    profile_id,
    phone_normalized,
    token_hash,
    expires_at
  )
  values (
    v_profile_id,
    v_phone,
    v_token_hash,
    now() + interval '5 minutes'
  );

  update public.password_recovery_state s
     set challenge_passed_at = null,
         updated_at = now()
   where s.phone_normalized = v_phone;

  v_psw_user := public.get_app_parameter_value('psw_user');

  v_send_to_user := lower(trim(coalesce(v_psw_user, ''))) in ('sim', 's', 'yes', 'y', '1', 'true', 'verdadeiro');

  if v_send_to_user then
    v_recipient_digits := v_phone;
    v_message :=
      'Seu código de recuperação de senha é: ' || v_token
      || '. Válido por 5 minutos. Informe-o no app para definir uma nova senha.';
  else
    v_manager_digits := public.get_app_parameter_value('psw_mngr');

    v_recipient_digits := nullif(regexp_replace(coalesce(v_manager_digits, ''), '\D', '', 'g'), '');

    if v_recipient_digits is null then
      return jsonb_build_object(
        'ok', false,
        'message', 'Destino do WhatsApp não configurado (psw_mngr).'
      );
    end if;

    v_message :=
      'Código de recuperação de senha para o celular ' || v_phone || ': ' || v_token
      || '. Válido por 5 minutos.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Desafio Superado',
    'whatsapp_message', v_message,
    'recipient_digits', v_recipient_digits,
    'send_to_user', v_send_to_user
  );
end;
$$;

create or replace function public.password_recovery_reset_access_pin(
  p_phone text,
  p_token text,
  p_new_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_phone text;
  v_new_pin text;
  v_token text;
  v_token_row public.password_recovery_tokens;
begin
  v_phone := public.password_recovery_phone_key(p_phone);
  v_new_pin := nullif(trim(coalesce(p_new_pin, '')), '');
  v_token := nullif(trim(coalesce(p_token, '')), '');

  if v_phone is null or length(v_phone) < 10 then
    return public.password_recovery_generic_error();
  end if;

  if v_token is null or v_token !~ '^[0-9]{4}$' then
    return jsonb_build_object(
      'ok', false,
      'message', 'Informe o código de 4 dígitos recebido no WhatsApp.'
    );
  end if;

  if v_new_pin is null or v_new_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object(
      'ok', false,
      'message', 'A nova senha deve ter 4 dígitos.'
    );
  end if;

  if public.password_recovery_is_blocked(p_phone) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Recuperação temporariamente indisponível.',
      'blocked', true
    );
  end if;

  select t.*
    into v_token_row
    from public.password_recovery_tokens t
   where t.phone_normalized = v_phone
     and t.used_at is null
     and t.expires_at > now()
   order by t.created_at desc
   limit 1;

  if v_token_row.id is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Código inválido ou expirado. Solicite um novo código.'
    );
  end if;

  v_profile_id := v_token_row.profile_id;

  if crypt(v_token, v_token_row.token_hash) <> v_token_row.token_hash then
    return jsonb_build_object(
      'ok', false,
      'message', 'Código inválido ou expirado. Solicite um novo código.'
    );
  end if;

  update public.profiles p
     set access_pin = v_new_pin,
         updated_at = now()
   where p.id = v_profile_id;

  update public.password_recovery_tokens t
     set used_at = now()
   where t.id = v_token_row.id;

  update public.password_recovery_state s
     set failed_challenge_attempts = 0,
         blocked_until = null,
         challenge_passed_at = null,
         updated_at = now()
   where s.phone_normalized = v_phone;

  return jsonb_build_object(
    'ok', true,
    'message', 'Senha redefinida com sucesso.'
  );
end;
$$;

create or replace function public.set_profile_security_question(
  p_phone text,
  p_current_pin text,
  p_question text,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_question text;
  v_answer text;
  v_current_pin text;
  v_stored_pin text;
begin
  v_current_pin := nullif(trim(coalesce(p_current_pin, '')), '');

  if v_current_pin is null or v_current_pin !~ '^[0-9]{4}$' then
    raise exception 'Informe a senha atual com 4 dígitos.';
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    raise exception 'Perfil não encontrado para este celular.';
  end if;

  select p.access_pin
    into v_stored_pin
    from public.profiles p
   where p.id = v_profile_id;

  if v_stored_pin is null or v_stored_pin <> v_current_pin then
    raise exception 'Senha atual incorreta.';
  end if;

  v_question := trim(coalesce(p_question, ''));
  v_answer := public.normalize_security_answer(p_answer);

  if char_length(v_question) < 5 then
    raise exception 'Informe uma pergunta de segurança com pelo menos 5 caracteres.';
  end if;

  if char_length(v_answer) < 2 then
    raise exception 'Informe uma resposta de segurança com pelo menos 2 caracteres.';
  end if;

  update public.profiles p
     set security_question = v_question,
         security_answer_hash = crypt(v_answer, gen_salt('bf', 10)),
         updated_at = now()
   where p.id = v_profile_id;

  return jsonb_build_object(
    'ok', true,
    'security_question', v_question
  );
end;
$$;

create or replace function public.save_my_profile_security_question(
  p_question text,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_question text;
  v_answer text;
begin
  v_profile_id := public.current_session_profile_id();

  if v_profile_id is null then
    raise exception 'Sessão não encontrada. Entre novamente no app.';
  end if;

  v_question := trim(coalesce(p_question, ''));
  v_answer := public.normalize_security_answer(p_answer);

  if char_length(v_question) < 5 then
    raise exception 'Informe uma pergunta de segurança com pelo menos 5 caracteres.';
  end if;

  if char_length(v_answer) < 2 then
    raise exception 'Informe uma resposta de segurança com pelo menos 2 caracteres.';
  end if;

  update public.profiles p
     set security_question = v_question,
         security_answer_hash = crypt(v_answer, gen_salt('bf', 10)),
         updated_at = now()
   where p.id = v_profile_id;

  return jsonb_build_object(
    'ok', true,
    'security_question', v_question
  );
end;
$$;

create or replace function public.set_profile_security_question(
  p_question text,
  p_answer text
)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select public.save_my_profile_security_question(p_question, p_answer);
$$;

create or replace function public.get_profile_security_question()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_question text;
begin
  v_profile_id := public.current_session_profile_id();

  if v_profile_id is null then
    return jsonb_build_object('ok', false, 'configured', false);
  end if;

  select nullif(trim(p.security_question), '')
    into v_question
    from public.profiles p
   where p.id = v_profile_id;

  return jsonb_build_object(
    'ok', true,
    'configured', v_question is not null,
    'security_question', coalesce(v_question, '')
  );
end;
$$;

grant execute on function public.find_profile_id_for_password_recovery(text) to anon, authenticated;
grant execute on function public.password_recovery_identify(text) to anon, authenticated;
grant execute on function public.password_recovery_verify_challenge(text, text) to anon, authenticated;
grant execute on function public.password_recovery_verify_challenge_and_dispatch(text, text) to anon, authenticated;
grant execute on function public.password_recovery_dispatch_token(text) to anon, authenticated;
grant execute on function public.password_recovery_reset_access_pin(text, text, text) to anon, authenticated;
grant execute on function public.set_profile_security_question(text, text, text, text) to anon, authenticated;
grant execute on function public.set_profile_security_question(text, text) to authenticated;
grant execute on function public.save_my_profile_security_question(text, text) to authenticated;
grant execute on function public.get_profile_security_question() to anon, authenticated;
