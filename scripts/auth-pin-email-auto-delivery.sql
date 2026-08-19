-- =============================================================================
-- PIN por e-mail: envio automático estável (plataforma + 1º acesso)
-- =============================================================================
-- 1) recovery_email_* cai no tenant padrão (IBN) se a instância atual não tiver.
-- 2) Visitante sem nome completo continua no fluxo de receber código, mesmo com PIN.
-- =============================================================================

begin;

create or replace function public.get_platform_app_parameter_value(p_parameter text)
returns text
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_default uuid := public.resolve_default_tenant_id();
  v_value text;
begin
  select ap.value
    into v_value
    from public.app_parameters ap
   where ap.tenant_id = v_tenant
     and lower(trim(ap.parameter)) = lower(trim(p_parameter))
   order by
     case when ap.parameter = trim(p_parameter) then 0 else 1 end,
     ap.parameter
   limit 1;

  if nullif(trim(coalesce(v_value, '')), '') is not null then
    return v_value;
  end if;

  if v_default is not null and v_default is distinct from v_tenant then
    select ap.value
      into v_value
      from public.app_parameters ap
     where ap.tenant_id = v_default
       and lower(trim(ap.parameter)) = lower(trim(p_parameter))
     order by
       case when ap.parameter = trim(p_parameter) then 0 else 1 end,
       ap.parameter
     limit 1;
  end if;

  return v_value;
end;
$$;

grant execute on function public.get_platform_app_parameter_value(text) to anon, authenticated, service_role;

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
  v_html text;
begin
  v_recipient := public.normalize_profile_email(p_to_email);

  if v_recipient is null or not public.is_valid_profile_email(v_recipient) then
    raise exception 'E-mail inválido para envio.';
  end if;

  v_api_key := nullif(trim(public.get_platform_app_parameter_value('recovery_email_api_key')), '');
  v_from := nullif(trim(public.get_platform_app_parameter_value('recovery_email_from')), '');

  if v_api_key is null or v_from is null then
    raise exception
      'Resend não configurado. Cadastre recovery_email_api_key e recovery_email_from em app_parameters.';
  end if;

  v_html :=
    '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111">'
    || replace(replace(coalesce(p_text, ''), '&', '&amp;'), E'\n', '<br/>')
    || '</div>';

  v_body := json_build_object(
    'from', v_from,
    'to', json_build_array(v_recipient),
    'subject', trim(p_subject),
    'text', p_text,
    'html', v_html
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
      coalesce(nullif(trim(v_content), ''), 'Verifique recovery_email_api_key, recovery_email_from e o domínio no Resend.');
  end if;

  begin
    v_payload := v_content::jsonb;
  exception
    when others then
      v_payload := jsonb_build_object('raw', v_content);
  end;

  if nullif(trim(coalesce(v_payload->>'id', '')), '') is null then
    raise exception
      'Resend respondeu sem ID de envio. Conteúdo: %',
      coalesce(nullif(trim(v_content), ''), '(vazio)');
  end if;

  return jsonb_build_object(
    'ok', true,
    'provider', 'resend',
    'resendId', v_payload->>'id',
    'to', v_recipient
  );
end;
$$;

grant execute on function public.send_resend_transactional_email(text, text, text)
  to postgres, service_role;

create or replace function public.auth_pin_get_delivery_state(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_email text;
  v_full_name text;
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
      'needs_first_access', false,
      'is_totem', true,
      'email_masked', '',
      'preferred_channel', public.auth_notification_channel()
    );
  end if;

  select
    public.normalize_profile_email(p.email),
    nullif(trim(coalesce(p.full_name, '')), ''),
    coalesce(nullif(trim(p.access_pin), ''), '') <> ''
  into v_email, v_full_name, v_has_pin
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
    'needs_first_access', v_full_name is null,
    'is_totem', false,
    'email_masked', coalesce(public.mask_profile_email(v_email), ''),
    'preferred_channel', public.auth_notification_channel()
  );
end;
$$;

grant execute on function public.auth_pin_get_delivery_state(text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;

select 'auth-pin-email-auto-delivery: ok' as status;
