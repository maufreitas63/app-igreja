-- =============================================================================
-- PTT Walkie-Talkie — diálogo bidirecional (conversas ativas)
-- =============================================================================
-- Execute TODO este arquivo no SQL Editor do Supabase.
--
-- Modelo:
--   - ptt_conversations: sessão 1:1 (initiator ↔ peer), status open|ended
--   - primeira mensagem do Estacionamento abre conversa com cada servo
--     do Ministério De Acolhimento em disponibilidade
--   - qualquer ponta responde com reply_ptt_conversation
--   - qualquer ponta encerra com end_ptt_conversation
--   - primeira resposta do peer encerra as outras conversas abertas
--     do mesmo initiator (um canal de rádio por vez)
-- =============================================================================

begin;

create table if not exists public.ptt_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas(id) on delete cascade,
  initiator_profile_id uuid not null references public.profiles(id) on delete cascade,
  peer_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'ended')),
  ended_by_profile_id uuid references public.profiles(id) on delete set null,
  ended_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ptt_conversations_distinct_peers check (initiator_profile_id <> peer_profile_id)
);

create unique index if not exists ptt_conversations_open_pair_uidx
  on public.ptt_conversations (tenant_id, initiator_profile_id, peer_profile_id)
  where status = 'open';

create index if not exists ptt_conversations_participant_open_idx
  on public.ptt_conversations (tenant_id, status, last_message_at desc);

alter table public.ptt_conversations enable row level security;

drop policy if exists ptt_conversations_select_own on public.ptt_conversations;
create policy ptt_conversations_select_own
  on public.ptt_conversations
  for select
  to anon, authenticated
  using (
    initiator_profile_id = public.current_session_profile_id()
    or peer_profile_id = public.current_session_profile_id()
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

drop policy if exists ptt_conversations_update_own on public.ptt_conversations;
create policy ptt_conversations_update_own
  on public.ptt_conversations
  for update
  to anon, authenticated
  using (
    initiator_profile_id = public.current_session_profile_id()
    or peer_profile_id = public.current_session_profile_id()
    or public.is_super_admin_profile(public.current_session_profile_id())
  )
  with check (
    initiator_profile_id = public.current_session_profile_id()
    or peer_profile_id = public.current_session_profile_id()
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

alter table public.ptt_messages
  add column if not exists conversation_id uuid references public.ptt_conversations(id) on delete set null;

create index if not exists ptt_messages_conversation_idx
  on public.ptt_messages (conversation_id, created_at asc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.ptt_profile_display_name(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.full_name), ''), 'Voluntário')
  from public.profiles p
  where p.id = p_profile_id
  limit 1;
$$;

create or replace function public.ptt_other_participant(
  p_conversation_id uuid,
  p_profile_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.initiator_profile_id = p_profile_id then c.peer_profile_id
    when c.peer_profile_id = p_profile_id then c.initiator_profile_id
    else null
  end
  from public.ptt_conversations c
  where c.id = p_conversation_id
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Enviar (inicia diálogo ou continua o aberto do Estacionamento)
-- ---------------------------------------------------------------------------
drop function if exists public.send_ptt_estacionamento_message(text, text, text, text, text, text);

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

  -- Continuar conversa explícita ou a única aberta do remetente
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

  -- Se já existe conversa aberta do initiator, continua a mais recente (diálogos)
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

  -- Nova chamada: abre 1 conversa por destinatário (nunca consigo mesmo)
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

-- ---------------------------------------------------------------------------
-- Responder em conversa ativa (qualquer ponta)
-- ---------------------------------------------------------------------------
create or replace function public.reply_ptt_conversation(
  p_conversation_id uuid,
  p_remetente text,
  p_setor text default null,
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
  v_remetente text := nullif(trim(coalesce(p_remetente, '')), '');
  v_setor text;
  v_texto text := coalesce(trim(p_texto_transcrito), '');
  v_ts text := coalesce(
    nullif(trim(p_timestamp), ''),
    to_char(timezone('America/Sao_Paulo', now()), 'HH24:MI:SS')
  );
  v_conv public.ptt_conversations%rowtype;
  v_peer uuid;
  v_payload jsonb;
  v_new_id uuid;
begin
  if v_sender is null or p_conversation_id is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  select * into v_conv
  from public.ptt_conversations c
  where c.id = p_conversation_id
    and c.tenant_id = v_tenant
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Conversa não encontrada.');
  end if;

  if v_conv.status <> 'open' then
    return jsonb_build_object('success', false, 'message', 'Esta conversa já foi encerrada.');
  end if;

  if v_conv.initiator_profile_id <> v_sender and v_conv.peer_profile_id <> v_sender then
    return jsonb_build_object('success', false, 'message', 'Você não participa desta conversa.');
  end if;

  v_peer := public.ptt_other_participant(v_conv.id, v_sender);

  if v_remetente is null then
    v_remetente := public.ptt_profile_display_name(v_sender);
  end if;

  v_setor := coalesce(
    nullif(trim(p_setor), ''),
    case
      when v_sender = v_conv.initiator_profile_id then 'Estacionamento'
      else 'Ministério De Acolhimento'
    end
  );

  v_payload := jsonb_build_object(
    'remetente', v_remetente,
    'setor', v_setor,
    'audio_url', coalesce(p_audio_url, ''),
    'texto_transcrito', v_texto,
    'timestamp', v_ts,
    'conversation_id', v_conv.id
  );

  insert into public.ptt_messages (
    tenant_id, sender_profile_id, recipient_profile_id, conversation_id,
    remetente, setor, audio_path, audio_url, texto_transcrito, payload
  ) values (
    v_tenant, v_sender, v_peer, v_conv.id,
    v_remetente, v_setor,
    nullif(trim(coalesce(p_audio_path, '')), ''),
    nullif(trim(coalesce(p_audio_url, '')), ''),
    v_texto, v_payload
  ) returning id into v_new_id;

  update public.ptt_conversations
     set last_message_at = now()
   where id = v_conv.id;

  -- Primeira resposta do peer concentra o canal (encerra outras chamadas do initiator)
  if v_sender = v_conv.peer_profile_id then
    update public.ptt_conversations c
       set status = 'ended',
           ended_at = coalesce(c.ended_at, now()),
           ended_by_profile_id = coalesce(c.ended_by_profile_id, v_sender)
     where c.tenant_id = v_tenant
       and c.initiator_profile_id = v_conv.initiator_profile_id
       and c.id <> v_conv.id
       and c.status = 'open';
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Resposta enviada.',
    'message_id', v_new_id,
    'conversation_id', v_conv.id,
    'payload', v_payload
  );
end;
$$;

grant execute on function public.reply_ptt_conversation(uuid, text, text, text, text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Encerrar conversa (qualquer ponta)
-- ---------------------------------------------------------------------------
create or replace function public.end_ptt_conversation(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile uuid := public.current_session_profile_id();
  v_conv public.ptt_conversations%rowtype;
begin
  if v_profile is null or p_conversation_id is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  select * into v_conv
  from public.ptt_conversations c
  where c.id = p_conversation_id
    and c.tenant_id = v_tenant
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Conversa não encontrada.');
  end if;

  if v_conv.initiator_profile_id <> v_profile and v_conv.peer_profile_id <> v_profile then
    return jsonb_build_object('success', false, 'message', 'Você não participa desta conversa.');
  end if;

  if v_conv.status = 'ended' then
    return jsonb_build_object('success', true, 'message', 'Conversa já estava encerrada.', 'conversation_id', v_conv.id);
  end if;

  update public.ptt_conversations
     set status = 'ended',
         ended_at = now(),
         ended_by_profile_id = v_profile
   where id = v_conv.id;

  -- Ack de pendentes desta conversa para as duas pontas
  update public.ptt_messages m
     set acked_at = coalesce(m.acked_at, now()),
         delivered_at = coalesce(m.delivered_at, now())
   where m.conversation_id = v_conv.id
     and m.acked_at is null;

  return jsonb_build_object(
    'success', true,
    'message', 'Conversa encerrada.',
    'conversation_id', v_conv.id
  );
end;
$$;

grant execute on function public.end_ptt_conversation(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Listagens
-- ---------------------------------------------------------------------------
create or replace function public.list_open_ptt_conversations()
returns table (
  id uuid,
  initiator_profile_id uuid,
  peer_profile_id uuid,
  status text,
  last_message_at timestamptz,
  created_at timestamptz,
  other_profile_id uuid,
  other_name text,
  last_texto text,
  unread_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile uuid := public.current_session_profile_id();
begin
  if v_profile is null then
    return;
  end if;

  return query
  select
    c.id,
    c.initiator_profile_id,
    c.peer_profile_id,
    c.status,
    c.last_message_at,
    c.created_at,
    case
      when c.initiator_profile_id = v_profile then c.peer_profile_id
      else c.initiator_profile_id
    end as other_profile_id,
    public.ptt_profile_display_name(
      case
        when c.initiator_profile_id = v_profile then c.peer_profile_id
        else c.initiator_profile_id
      end
    ) as other_name,
    coalesce((
      select m.texto_transcrito
      from public.ptt_messages m
      where m.conversation_id = c.id
      order by m.created_at desc
      limit 1
    ), '') as last_texto,
    (
      select count(*)::bigint
      from public.ptt_messages m
      where m.conversation_id = c.id
        and m.recipient_profile_id = v_profile
        and m.acked_at is null
    ) as unread_count
  from public.ptt_conversations c
  where c.tenant_id = v_tenant
    and c.status = 'open'
    and (c.initiator_profile_id = v_profile or c.peer_profile_id = v_profile)
  order by c.last_message_at desc;
end;
$$;

grant execute on function public.list_open_ptt_conversations() to anon, authenticated;

create or replace function public.list_ptt_conversation_messages(p_conversation_id uuid)
returns setof public.ptt_messages
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile uuid := public.current_session_profile_id();
  v_ok boolean := false;
begin
  if v_profile is null or p_conversation_id is null then
    return;
  end if;

  select true into v_ok
  from public.ptt_conversations c
  where c.id = p_conversation_id
    and c.tenant_id = v_tenant
    and (c.initiator_profile_id = v_profile or c.peer_profile_id = v_profile)
  limit 1;

  if not coalesce(v_ok, false) then
    return;
  end if;

  return query
  select m.*
  from public.ptt_messages m
  where m.tenant_id = v_tenant
    and m.conversation_id = p_conversation_id
  order by m.created_at asc;
end;
$$;

grant execute on function public.list_ptt_conversation_messages(uuid) to anon, authenticated;

create or replace function public.get_ptt_conversation(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile uuid := public.current_session_profile_id();
  v_row record;
begin
  if v_profile is null or p_conversation_id is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  select
    c.*,
    case
      when c.initiator_profile_id = v_profile then c.peer_profile_id
      else c.initiator_profile_id
    end as other_profile_id,
    public.ptt_profile_display_name(
      case
        when c.initiator_profile_id = v_profile then c.peer_profile_id
        else c.initiator_profile_id
      end
    ) as other_name
  into v_row
  from public.ptt_conversations c
  where c.id = p_conversation_id
    and c.tenant_id = v_tenant
    and (c.initiator_profile_id = v_profile or c.peer_profile_id = v_profile)
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Conversa não encontrada.');
  end if;

  return jsonb_build_object(
    'success', true,
    'conversation', to_jsonb(v_row)
  );
end;
$$;

grant execute on function public.get_ptt_conversation(uuid) to anon, authenticated;

-- Ack em lote por conversa (mantém diálogo aberto)
create or replace function public.ack_ptt_conversation_messages(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_n int := 0;
begin
  if v_profile is null or p_conversation_id is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  update public.ptt_messages m
     set acked_at = coalesce(m.acked_at, now()),
         delivered_at = coalesce(m.delivered_at, now())
   where m.conversation_id = p_conversation_id
     and m.recipient_profile_id = v_profile
     and m.acked_at is null;

  get diagnostics v_n = row_count;
  return jsonb_build_object('success', true, 'acked', v_n);
end;
$$;

grant execute on function public.ack_ptt_conversation_messages(uuid) to anon, authenticated;

-- Realtime nas conversas
do $$
begin
  alter publication supabase_realtime add table public.ptt_conversations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
