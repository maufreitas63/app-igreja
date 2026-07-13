-- Corrige envio do código de 1º acesso por e-mail (novos usuários).
--
-- Problemas cobertos:
-- 1) Assunto genérico de "nova senha" (parece recuperação) e texto pouco claro.
-- 2) dispatch retornava ok sem expor o ID do Resend (difícil diagnosticar).
-- 3) Falha do Resend precisa voltar mensagem explícita ao app.
--
-- Pré-requisitos já aplicadosados:
--   password-recovery-email-flow.sql (send_resend_transactional_email)
--   auth-pin-email-only.sql / preparar-perfil-acesso-cadastro.sql
--   app_parameters: recovery_email_provider=resend, api_key, from=nao-responda@conectamais.api.br
--   Extensão Database → Extensions → http habilitada
--
-- Execute no SQL Editor do Supabase. Depois confira em https://resend.com/emails

create or replace function public.access_pin_first_access_email_text(p_pin text)
returns text
language sql
immutable
as $$
  select
    'Olá,' || E'\n\n'
    || 'Seu código de acesso ao Conecta Mais é: ' || p_pin || E'\n\n'
    || 'São 4 dígitos. Digite-os na tela de entrada do aplicativo.' || E'\n\n'
    || 'Se você não solicitou este código, ignore este e-mail.';
$$;

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

  v_api_key := nullif(trim(public.get_app_parameter_value('recovery_email_api_key')), '');
  v_from := nullif(trim(public.get_app_parameter_value('recovery_email_from')), '');

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

create or replace function public.send_password_recovery_pin_email_via_resend(
  p_to_email text,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
begin
  perform public.send_resend_transactional_email(
    p_to_email,
    'Sua nova senha de acesso — Conecta Mais',
    public.password_recovery_pin_email_text(p_pin)
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

  -- E-mail informado no botão SEMPRE tem prioridade (evita enviar ao e-mail antigo do perfil).
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
    -- Envio direto via Resend (exige ID de confirmação).
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
grant execute on function public.send_resend_transactional_email(text, text, text) to postgres, service_role;

notify pgrst, 'reload schema';

-- === Diagnóstico (mesmo caminho do botão do app) ===
-- select public.dispatch_auth_access_pin_email(
--   '19999999999',          -- celular só dígitos
--   'destino@email.com',    -- e-mail que o usuário digitou
--   'destino@email.com'
-- );
-- Esperado: ok=true, resend_id preenchido, to=destino@email.com
-- Confira em https://resend.com/emails o destinatário (To).
