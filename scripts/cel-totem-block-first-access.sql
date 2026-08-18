-- Impede que o celular do totem (app_parameters.cel_totem) entre no fluxo de
-- primeiro acesso / visitante. O totem usa só a senha 9999, sem perfil nem e-mail.
--
-- Também lista os números de totem de todas as igrejas (login ainda sem tenant).

create or replace function public.canonical_br_phone_digits(p_phone text)
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

  if char_length(v_digits) > 11 then
    v_digits := right(v_digits, 11);
  end if;

  if char_length(v_digits) < 10 then
    return null;
  end if;

  return v_digits;
end;
$$;

create or replace function public.is_cel_totem_phone(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.app_parameters ap
     where lower(trim(ap.parameter)) = 'cel_totem'
       and public.canonical_br_phone_digits(ap.value) = public.canonical_br_phone_digits(p_phone)
  );
$$;

create or replace function public.list_cel_totem_phones()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(distinct public.canonical_br_phone_digits(ap.value))
      filter (where public.canonical_br_phone_digits(ap.value) is not null),
    '{}'::text[]
  )
  from public.app_parameters ap
  where lower(trim(ap.parameter)) = 'cel_totem';
$$;

grant execute on function public.canonical_br_phone_digits(text) to anon, authenticated;
grant execute on function public.is_cel_totem_phone(text) to anon, authenticated;
grant execute on function public.list_cel_totem_phones() to anon, authenticated;

create or replace function public.auth_pin_get_delivery_state(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_email text;
  v_has_pin boolean := false;
begin
  perform public.assert_auth_notification_channel_email();

  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');

  if v_phone is null or char_length(v_phone) < 10 then
    return jsonb_build_object('ok', false, 'message', 'Informe um celular válido com DDD.');
  end if;

  if public.is_cel_totem_phone(v_phone) then
    return jsonb_build_object(
      'ok', true,
      'has_pin', true,
      'needs_email', false,
      'is_totem', true,
      'email_masked', '',
      'preferred_channel', public.auth_notification_channel()
    );
  end if;

  select
    public.normalize_profile_email(p.email),
    coalesce(nullif(trim(p.access_pin), ''), '') <> ''
  into v_email, v_has_pin
  from public.profiles p
  where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_phone
     or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = right(v_phone, 11)
     or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = right(v_phone, 10)
  order by p.created_at asc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'has_pin', coalesce(v_has_pin, false),
    'needs_email', v_email is null,
    'is_totem', false,
    'email_masked', coalesce(public.mask_profile_email(v_email), ''),
    'preferred_channel', public.auth_notification_channel()
  );
end;
$$;

grant execute on function public.auth_pin_get_delivery_state(text) to anon, authenticated;

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

  v_visitor := public.prepare_visitor_access_pin(v_phone);
  v_pin := nullif(trim(coalesce(v_visitor ->> 'pin', '')), '');

  begin
    v_profile_id := nullif(trim(coalesce(v_visitor ->> 'profile_id', '')), '')::uuid;
  exception
    when others then
      v_profile_id := null;
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

  v_email := public.normalize_profile_email(p_email);
  v_confirm := public.normalize_profile_email(p_email_confirm);

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

grant execute on function public.dispatch_auth_access_pin_email(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
