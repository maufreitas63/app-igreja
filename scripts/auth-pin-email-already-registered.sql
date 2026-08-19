-- =============================================================================
-- Primeiro acesso: e-mail já cadastrado em outro celular
-- =============================================================================
-- Se a pessoa informa um e-mail que já existe em outro perfil, não cria visitante
-- nem envia PIN. Orienta a entrar com o celular anterior e alterar o número
-- em Dados cadastrais.
-- =============================================================================

begin;

create or replace function public.mask_profile_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  v_digits := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');

  if v_digits is null then
    return null;
  end if;

  if v_digits like '55%' and char_length(v_digits) >= 12 then
    v_digits := substr(v_digits, 3);
  end if;

  if char_length(v_digits) = 11 then
    return '(' || substr(v_digits, 1, 2) || ') ' || substr(v_digits, 3, 1)
      || '****-' || substr(v_digits, 8, 4);
  end if;

  if char_length(v_digits) = 10 then
    return '(' || substr(v_digits, 1, 2) || ') ****-' || substr(v_digits, 7, 4);
  end if;

  return null;
end;
$$;

create or replace function public.auth_email_in_use_message(
  p_email text,
  p_except_profile_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := public.normalize_profile_email(p_email);
  v_phone text;
  v_masked text;
begin
  if v_email is null then
    return null;
  end if;

  select p.phone
    into v_phone
    from public.profiles p
   where public.normalize_profile_email(p.email) = v_email
     and p.id is distinct from p_except_profile_id
   order by p.updated_at desc nulls last
   limit 1;

  if v_phone is null then
    return null;
  end if;

  v_masked := public.mask_profile_phone(v_phone);

  return 'Este e-mail já está cadastrado. Entre com o celular anterior'
    || case
         when v_masked is not null then ': ' || v_masked
         else ''
       end
    || '. Depois do acesso, altere o número em Dados cadastrais.';
end;
$$;

grant execute on function public.mask_profile_phone(text) to anon, authenticated;
grant execute on function public.auth_email_in_use_message(text, uuid) to anon, authenticated;

create or replace function public.dispatch_auth_access_pin_email(
  p_phone text,
  p_email text default null,
  p_email_confirm text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, http, extensions, pg_temp
as $$
declare
  v_phone text;
  v_email text;
  v_confirm text;
  v_profile_id uuid;
  v_pin text;
  v_email_masked text;
  v_visitor jsonb;
  v_send jsonb;
  v_conflict text;
begin
  perform public.assert_auth_notification_channel_email();

  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');

  if v_phone is null or char_length(v_phone) < 10 then
    return jsonb_build_object('ok', false, 'message', 'Informe um celular válido com DDD.');
  end if;

  if public.is_cel_totem_phone(v_phone) then
    return jsonb_build_object(
      'ok', false,
      'is_totem', true,
      'message', 'Este celular é do totem. Digite a senha 9999 — não há código por e-mail.'
    );
  end if;

  v_email := public.normalize_profile_email(p_email);
  v_confirm := public.normalize_profile_email(p_email_confirm);
  v_profile_id := public.find_profile_id_by_phone(v_phone);

  if v_email is not null then
    if v_confirm is not null and v_email <> v_confirm then
      return jsonb_build_object(
        'ok', false,
        'needs_email', true,
        'message', 'Os e-mails informados não coincidem.'
      );
    end if;

    if not public.is_valid_profile_email(v_email) then
      return jsonb_build_object(
        'ok', false,
        'needs_email', true,
        'message', 'Informe um e-mail válido.'
      );
    end if;

    v_conflict := public.auth_email_in_use_message(v_email, v_profile_id);
    if v_conflict is not null then
      return jsonb_build_object(
        'ok', false,
        'email_in_use', true,
        'needs_email', true,
        'message', v_conflict
      );
    end if;
  end if;

  v_visitor := public.prepare_visitor_access_pin(v_phone);
  v_pin := nullif(trim(coalesce(v_visitor ->> 'pin', '')), '');

  begin
    v_profile_id := nullif(trim(coalesce(v_visitor ->> 'profile_id', '')), '')::uuid;
  exception
    when others then
      null;
  end;

  if v_profile_id is null then
    v_profile_id := public.find_profile_id_by_phone(v_phone);
  end if;

  if v_pin is null or v_pin !~ '^\d{4}$' then
    v_pin := public.regenerate_profile_access_pin(v_phone);
  end if;

  if v_profile_id is null or v_pin is null or v_pin !~ '^\d{4}$' then
    return jsonb_build_object(
      'ok', false,
      'message',
      'Perfil não encontrado. Execute scripts/preparar-perfil-acesso-cadastro.sql no Supabase.'
    );
  end if;

  if v_email is not null then
    update public.profiles
       set email = v_email,
           updated_at = now()
     where id = v_profile_id;
  else
    select public.normalize_profile_email(p.email)
      into v_email
      from public.profiles p
     where p.id = v_profile_id;

    if v_email is null then
      return jsonb_build_object(
        'ok', false,
        'needs_email', true,
        'message', 'Informe e confirme o e-mail para receber o código de acesso.'
      );
    end if;
  end if;

  begin
    execute $sql$
      update public.profiles
         set preferred_auth_channel = 'email',
             updated_at = now()
       where id = $1
    $sql$
    using v_profile_id;
  exception
    when undefined_column then
      null;
  end;

  v_email_masked := public.mask_profile_email(v_email);

  begin
    v_send := public.send_resend_transactional_email(
      v_email,
      'Seu código de acesso — Conecta Mais',
      public.access_pin_first_access_email_text(v_pin)
    );
  exception
    when others then
      return jsonb_build_object(
        'ok', false,
        'message',
        coalesce(
          nullif(trim(sqlerrm), ''),
          'Falha ao enviar o código por e-mail. Verifique Resend e app_parameters (provider/api_key/from).'
        )
      );
  end;

  if coalesce((v_send->>'ok')::boolean, false) is not true
     or nullif(trim(coalesce(v_send->>'resendId', '')), '') is null then
    return jsonb_build_object(
      'ok', false,
      'message',
      'O provedor de e-mail não confirmou o envio. Confira a API key do Resend e https://resend.com/emails.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'channel', public.auth_notification_channel(),
    'preferred_channel', 'email',
    'provider', 'resend',
    'resend_id', v_send->>'resendId',
    'to', v_email,
    'message',
      'Enviamos o código de acesso para '
      || coalesce(v_email_masked, 'seu e-mail')
      || '. Confira a caixa de entrada e o spam.',
    'email_masked', coalesce(v_email_masked, '')
  );
end;
$$;

grant execute on function public.dispatch_auth_access_pin_email(text, text, text)
  to anon, authenticated;

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
  v_conflict text;
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

  v_conflict := public.auth_email_in_use_message(v_email, v_profile_id);
  if v_conflict is not null then
    return jsonb_build_object(
      'ok', false,
      'email_in_use', true,
      'message', v_conflict
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

grant execute on function public.password_recovery_set_email(text, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;

select 'auth-pin-email-already-registered: ok' as status;
