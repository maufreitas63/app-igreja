-- =============================================================================
-- Patch PTT: destino = Servos em Disponibilidade do Ministério De Acolhimento
-- =============================================================================
-- Substitui o roteamento por escala do dia em acolhimento_recepcao.
-- Execute no SQL Editor do Supabase (idempotente via CREATE OR REPLACE).
-- =============================================================================

create or replace function public.ptt_list_acolhimento_recepcao_recipients(
  p_service_date date default public.ptt_service_date_today()
)
returns table (
  profile_id uuid,
  volunteer_name text,
  tipo_escala_codigo text,
  tipo_escala_nome text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform p_service_date;

  return query
  select distinct on (p.id)
    p.id as profile_id,
    ve.nome as volunteer_name,
    te.codigo as tipo_escala_codigo,
    te.nome as tipo_escala_nome
  from public.voluntarios_escala ve
  join public.tipos_escala te
    on te.id = ve.tipo_escala_id
   and te.tenant_id = v_tenant
   and te.is_ativa = true
  join public.profiles p
    on p.tenant_id = v_tenant
   and public.ptt_normalize_name(p.full_name) = public.ptt_normalize_name(ve.nome)
  where ve.tenant_id = v_tenant
    and ve.is_ativo = true
    and lower(replace(trim(te.codigo), ' ', '')) not like '%estacionamento%'
    and public.ptt_normalize_name(te.nome) not like '%estacionamento%'
    and (
      lower(replace(trim(te.codigo), ' ', '')) in (
        'ministerioacolhimento',
        'acolhimento_recepcao',
        'acolhimentorecepcao'
      )
      or (
        public.ptt_normalize_name(te.nome) like '%ministerio%'
        and public.ptt_normalize_name(te.nome) like '%acolhimento%'
      )
      or (
        public.ptt_normalize_name(te.nome) like '%acolhimento%'
        and public.ptt_normalize_name(te.nome) like '%recep%'
      )
    )
  order by p.id, ve.ordem_sequencial nulls last, te.nome;
end;
$$;

grant execute on function public.ptt_list_acolhimento_recepcao_recipients(date) to anon, authenticated;

create or replace function public.send_ptt_estacionamento_message(
  p_remetente text,
  p_setor text default 'Estacionamento',
  p_audio_url text default null,
  p_audio_path text default null,
  p_texto_transcrito text default '',
  p_timestamp text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_sender uuid := public.current_session_profile_id();
  v_service_date date := public.ptt_service_date_today();
  v_remetente text := nullif(trim(coalesce(p_remetente, '')), '');
  v_setor text := coalesce(nullif(trim(p_setor), ''), 'Estacionamento');
  v_texto text := coalesce(trim(p_texto_transcrito), '');
  v_ts text := coalesce(
    nullif(trim(p_timestamp), ''),
    to_char(timezone('America/Sao_Paulo', now()), 'HH24:MI:SS')
  );
  v_payload jsonb;
  v_recipient record;
  v_ids uuid[] := '{}';
  v_count int := 0;
  v_new_id uuid;
begin
  if v_sender is null then
    return jsonb_build_object('success', false, 'message', 'Sessão sem perfil. Faça login novamente.');
  end if;

  if v_remetente is null then
    select nullif(trim(p.full_name), '') into v_remetente
    from public.profiles p
    where p.id = v_sender
    limit 1;
  end if;

  if v_remetente is null then
    return jsonb_build_object('success', false, 'message', 'Nome do remetente não encontrado.');
  end if;

  v_payload := jsonb_build_object(
    'remetente', v_remetente,
    'setor', v_setor,
    'audio_url', coalesce(p_audio_url, ''),
    'texto_transcrito', v_texto,
    'timestamp', v_ts
  );

  for v_recipient in
    select * from public.ptt_list_acolhimento_recepcao_recipients(v_service_date)
  loop
    insert into public.ptt_messages (
      tenant_id,
      sender_profile_id,
      recipient_profile_id,
      remetente,
      setor,
      audio_path,
      audio_url,
      texto_transcrito,
      payload
    )
    values (
      v_tenant,
      v_sender,
      v_recipient.profile_id,
      v_remetente,
      v_setor,
      nullif(trim(coalesce(p_audio_path, '')), ''),
      nullif(trim(coalesce(p_audio_url, '')), ''),
      v_texto,
      v_payload
    )
    returning id into v_new_id;

    v_ids := array_append(v_ids, v_new_id);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    return jsonb_build_object(
      'success', false,
      'message',
      'Nenhum servo em disponibilidade no Ministério De Acolhimento. '
        || 'Cadastre em Manutenção → Servos em Disponibilidade.',
      'service_date', v_service_date
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Mensagem roteada para Ministério De Acolhimento (disponibilidade).',
    'service_date', v_service_date,
    'recipient_count', v_count,
    'message_ids', to_jsonb(v_ids),
    'payload', v_payload
  );
end;
$$;

grant execute on function public.send_ptt_estacionamento_message(text, text, text, text, text, text)
  to anon, authenticated;
