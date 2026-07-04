-- PIN de autenticação exclusivamente por e-mail (primeira entrada e gateway central).
-- Pré-requisitos:
--   scripts/password-recovery-email-flow.sql  (send_password_recovery_pin_email, mask/normalize email)
--   scripts/preparar-perfil-acesso-cadastro.sql (prepare_visitor_access_pin / regenerate_profile_access_pin)
-- Execute no SQL Editor do Supabase. Depois: Settings → API → Reload schema.
--
-- HARD BLOCK: este script não contém caminho de mensageria instantânea. Canal imutável = email.

create or replace function public.auth_notification_channel()
returns text
language sql
immutable
as $$
  select 'email'::text;
$$;

create or replace function public.assert_auth_notification_channel_email()
returns void
language plpgsql
immutable
as $$
begin
  if public.auth_notification_channel() <> 'email' then
    raise exception 'AUTH_CHANNEL_BLOCKED: autenticação só pode enviar PIN por e-mail.';
  end if;
end;
$$;

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
    'email_masked', coalesce(public.mask_profile_email(v_email), ''),
    'preferred_channel', public.auth_notification_channel()
  );
end;
$$;

create or replace function public.dispatch_auth_access_pin_email(
  p_phone text,
  p_email text default null,
  p_email_confirm text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_email text;
  v_confirm text;
  v_profile_id uuid;
  v_pin text;
  v_email_masked text;
  v_visitor jsonb;
begin
  -- Canal imutável: e-mail apenas.
  perform public.assert_auth_notification_channel_email();

  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');

  if v_phone is null or char_length(v_phone) < 10 then
    return jsonb_build_object('ok', false, 'message', 'Informe um celular válido com DDD.');
  end if;

  -- Garante perfil (visitante) e PIN temporário no servidor.
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

  select public.normalize_profile_email(p.email)
    into v_email
  from public.profiles p
  where p.id = v_profile_id;

  if v_email is null then
    v_email := public.normalize_profile_email(p_email);
    v_confirm := public.normalize_profile_email(p_email_confirm);

    if v_email is null or v_confirm is null then
      return jsonb_build_object(
        'ok', false,
        'needs_email', true,
        'message', 'Informe e confirme o e-mail para receber o código de acesso.'
      );
    end if;

    if v_email <> v_confirm then
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
           -- Preferência de autenticação: sempre e-mail.
           updated_at = now()
     where id = v_profile_id;
  end if;

  -- Preferência de canal de autenticação (coluna opcional; ignora se não existir).
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
    perform public.send_password_recovery_pin_email(v_email, v_pin);
  exception
    when others then
      return jsonb_build_object(
        'ok', false,
        'message',
        coalesce(nullif(trim(sqlerrm), ''), 'Falha ao enviar o código por e-mail. Verifique a configuração de e-mail em app_parameters.')
      );
  end;

  return jsonb_build_object(
    'ok', true,
    'channel', public.auth_notification_channel(),
    'preferred_channel', 'email',
    'message', 'Enviamos o código de acesso para ' || coalesce(v_email_masked, 'seu e-mail') || '.',
    'email_masked', coalesce(v_email_masked, '')
  );
end;
$$;

-- Coluna opcional de preferência (idempotente).
alter table public.profiles
  add column if not exists preferred_auth_channel text;

comment on column public.profiles.preferred_auth_channel is
  'Canal preferido para PIN de autenticação. Valor operacional imutável: email.';

update public.profiles
   set preferred_auth_channel = 'email'
 where preferred_auth_channel is distinct from 'email';

grant execute on function public.auth_notification_channel() to anon, authenticated;
grant execute on function public.assert_auth_notification_channel_email() to anon, authenticated;
grant execute on function public.auth_pin_get_delivery_state(text) to anon, authenticated;
grant execute on function public.dispatch_auth_access_pin_email(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
