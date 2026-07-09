-- Patch: funções de PDF (execute se o teste 13 disser "function ... does not exist")
-- Pré-requisito: password-recovery-email-flow.sql (password_recovery_http_post)
-- Depois: rode 13-generate-pdf.sql ou use "Gerar PDF" no app

create or replace function public.invoke_media_authorization_pdf_generation(p_authorization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_pdf_function_url text;
  v_pdf_function_secret text;
  v_status integer;
  v_content text;
  v_body jsonb;
  v_payload jsonb;
  v_storage_path text;
begin
  if p_authorization_id is null then
    return jsonb_build_object('ok', false, 'message', 'Autorização não informada.');
  end if;

  if not exists (select 1 from public.authorizations a where a.id = p_authorization_id) then
    return jsonb_build_object('ok', false, 'message', 'Autorização não encontrada.');
  end if;

  v_pdf_function_url := public.get_app_parameter_value_trim('media_authorization_pdf_function_url');
  v_pdf_function_secret := public.get_app_parameter_value_trim('media_authorization_pdf_function_secret');

  if v_pdf_function_url is null or v_pdf_function_secret is null then
    return jsonb_build_object(
      'ok', false,
      'skipped', true,
      'message', 'PDF não configurado. Cadastre media_authorization_pdf_function_url e media_authorization_pdf_function_secret em app_parameters.'
    );
  end if;

  v_body := jsonb_build_object(
    'authorizationId', p_authorization_id,
    'secret', v_pdf_function_secret
  );

  select p.p_status, p.p_content
    into v_status, v_content
    from public.password_recovery_http_post(
      v_pdf_function_url,
      jsonb_build_object(
        'content-type', 'application/json',
        'authorization', 'Bearer ' || v_pdf_function_secret
      ),
      v_body::text
    ) as p;

  if coalesce(v_status, 0) not between 200 and 299 then
    return jsonb_build_object(
      'ok', false,
      'message',
      format(
        'Falha ao gerar PDF (HTTP %s). %s',
        coalesce(v_status, 0),
        coalesce(nullif(trim(v_content), ''), 'Verifique a Edge Function generate-authorization-pdf.')
      )
    );
  end if;

  begin
    v_payload := v_content::jsonb;
  exception
    when others then
      return jsonb_build_object(
        'ok', false,
        'message', 'Resposta inválida da Edge Function PDF.',
        'raw', coalesce(v_content, '')
      );
  end;

  if coalesce(v_payload->>'ok', '') <> 'true' then
    return jsonb_build_object(
      'ok', false,
      'message', coalesce(nullif(trim(v_payload->>'message'), ''), 'Edge Function PDF retornou erro.')
    );
  end if;

  v_storage_path := nullif(trim(v_payload->>'storagePath'), '');

  if v_storage_path is not null then
    update public.authorizations
       set storage_path = v_storage_path
     where id = p_authorization_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'storagePath', v_storage_path,
    'message', 'PDF gerado com sucesso.'
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'message', SQLERRM);
end;
$$;

create or replace function public.retry_media_authorization_pdf(p_authorization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := public.resolve_profile_id_for_media_authorization();

  if v_profile_id is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Sessão expirada. Faça login novamente.'
    );
  end if;

  if not exists (
    select 1
      from public.authorizations a
     where a.id = p_authorization_id
       and a.profile_id = v_profile_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Autorização não encontrada para o seu perfil.'
    );
  end if;

  return public.invoke_media_authorization_pdf_generation(p_authorization_id);
end;
$$;

grant execute on function public.invoke_media_authorization_pdf_generation(uuid) to anon, authenticated;
grant execute on function public.retry_media_authorization_pdf(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
