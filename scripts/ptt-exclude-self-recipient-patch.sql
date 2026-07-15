-- =============================================================================
-- PTT — não criar conversa consigo mesmo (distinct_peers)
-- =============================================================================
-- Erro típico:
--   new row for relation "ptt_conversations" violates check constraint
--   "ptt_conversations_distinct_peers"
--
-- Causa: o remetente (Estacionamento) também está em disponibilidade no
-- Ministério De Acolhimento e o roteamento tentava peer = initiator.
-- =============================================================================

begin;

create or replace function public.send_ptt_estacionamento_message(
  p_remetente text,
  p_setor text default 'Estacionamento',
  p_audio_url text default null,
  p_audio_path text default null,
  p_texto_transcrito text default '',
  p_timestamp text default null,
  p_conversation_id uuid default null
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
  v_conversation_ids uuid[] := '{}';
  v_count int := 0;
  v_new_id uuid;
  v_conv_id uuid;
  v_open_id uuid;
  v_open_peer uuid;
  v_peer uuid;
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

  if p_conversation_id is not null then
    select c.id
      into v_conv_id
    from public.ptt_conversations c
    where c.id = p_conversation_id
      and c.tenant_id = v_tenant
      and c.status = 'open'
      and (c.initiator_profile_id = v_sender or c.peer_profile_id = v_sender)
    limit 1;

    if v_conv_id is null then
      return jsonb_build_object('success', false, 'message', 'Conversa inativa ou inexistente.');
    end if;

    v_peer := public.ptt_other_participant(v_conv_id, v_sender);
    if v_peer is null or v_peer = v_sender then
      return jsonb_build_object('success', false, 'message', 'Participante da conversa inválido.');
    end if;

    insert into public.ptt_messages (
      tenant_id, sender_profile_id, recipient_profile_id, conversation_id,
      remetente, setor, audio_path, audio_url, texto_transcrito, payload
    ) values (
      v_tenant, v_sender, v_peer, v_conv_id,
      v_remetente, v_setor,
      nullif(trim(coalesce(p_audio_path, '')), ''),
      nullif(trim(coalesce(p_audio_url, '')), ''),
      v_texto, v_payload
    ) returning id into v_new_id;

    update public.ptt_conversations
       set last_message_at = now()
     where id = v_conv_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Mensagem enviada na conversa ativa.',
      'service_date', v_service_date,
      'recipient_count', 1,
      'message_ids', to_jsonb(ARRAY[v_new_id]),
      'conversation_ids', to_jsonb(ARRAY[v_conv_id]),
      'conversation_id', v_conv_id,
      'payload', v_payload
    );
  end if;

  select c.id, c.peer_profile_id
    into v_open_id, v_open_peer
  from public.ptt_conversations c
  where c.tenant_id = v_tenant
    and c.status = 'open'
    and c.initiator_profile_id = v_sender
    and c.peer_profile_id <> v_sender
  order by c.last_message_at desc
  limit 1;

  if v_open_id is not null then
    insert into public.ptt_messages (
      tenant_id, sender_profile_id, recipient_profile_id, conversation_id,
      remetente, setor, audio_path, audio_url, texto_transcrito, payload
    ) values (
      v_tenant, v_sender, v_open_peer, v_open_id,
      v_remetente, v_setor,
      nullif(trim(coalesce(p_audio_path, '')), ''),
      nullif(trim(coalesce(p_audio_url, '')), ''),
      v_texto, v_payload
    ) returning id into v_new_id;

    update public.ptt_conversations
       set last_message_at = now()
     where id = v_open_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Mensagem enviada na conversa ativa.',
      'service_date', v_service_date,
      'recipient_count', 1,
      'message_ids', to_jsonb(ARRAY[v_new_id]),
      'conversation_ids', to_jsonb(ARRAY[v_open_id]),
      'conversation_id', v_open_id,
      'payload', v_payload
    );
  end if;

  for v_recipient in
    select r.*
    from public.ptt_list_acolhimento_recepcao_recipients(v_service_date) r
    where r.profile_id is distinct from v_sender
  loop
    if v_recipient.profile_id is null or v_recipient.profile_id = v_sender then
      continue;
    end if;

    insert into public.ptt_conversations (
      tenant_id, initiator_profile_id, peer_profile_id, status, last_message_at
    ) values (
      v_tenant, v_sender, v_recipient.profile_id, 'open', now()
    )
    on conflict (tenant_id, initiator_profile_id, peer_profile_id) where (status = 'open')
    do nothing
    returning id into v_conv_id;

    if v_conv_id is null then
      select c.id into v_conv_id
      from public.ptt_conversations c
      where c.tenant_id = v_tenant
        and c.initiator_profile_id = v_sender
        and c.peer_profile_id = v_recipient.profile_id
        and c.status = 'open'
      limit 1;
    end if;

    if v_conv_id is null then
      continue;
    end if;

    insert into public.ptt_messages (
      tenant_id, sender_profile_id, recipient_profile_id, conversation_id,
      remetente, setor, audio_path, audio_url, texto_transcrito, payload
    ) values (
      v_tenant, v_sender, v_recipient.profile_id, v_conv_id,
      v_remetente, v_setor,
      nullif(trim(coalesce(p_audio_path, '')), ''),
      nullif(trim(coalesce(p_audio_url, '')), ''),
      v_texto, v_payload
    ) returning id into v_new_id;

    v_ids := array_append(v_ids, v_new_id);
    v_conversation_ids := array_append(v_conversation_ids, v_conv_id);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    return jsonb_build_object(
      'success', false,
      'message',
      'Nenhum outro servo em disponibilidade no Ministério De Acolhimento '
        || '(o remetente não pode receber a própria chamada). '
        || 'Cadastre outro servo em Manutenção → Servos em Disponibilidade.',
      'service_date', v_service_date
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Diálogo iniciado com Ministério De Acolhimento (disponibilidade).',
    'service_date', v_service_date,
    'recipient_count', v_count,
    'message_ids', to_jsonb(v_ids),
    'conversation_ids', to_jsonb(v_conversation_ids),
    'conversation_id', v_conversation_ids[1],
    'payload', v_payload
  );
end;
$$;

grant execute on function public.send_ptt_estacionamento_message(text, text, text, text, text, text, uuid)
  to anon, authenticated;

commit;
