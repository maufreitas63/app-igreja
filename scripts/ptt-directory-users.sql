-- =============================================================================
-- PTT Walkie-Talkie — diretório de usuários (quem pode falar com quem)
-- =============================================================================
-- Execute no SQL Editor do Supabase.
--
-- Modelo:
--   - ptt_directory_users: lista de perfis autorizados
--   - Qualquer membro ativo pode iniciar diálogo com outro membro ativo
--   - send_ptt_directory_message(p_peer_profile_id, ...) substitui o roteamento
--     Estacionamento → Ministério De Acolhimento
-- =============================================================================

begin;

create table if not exists public.ptt_directory_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  constraint ptt_directory_users_tenant_profile_uidx unique (tenant_id, profile_id)
);

create index if not exists ptt_directory_users_active_idx
  on public.ptt_directory_users (tenant_id, is_active, profile_id);

alter table public.ptt_directory_users enable row level security;

drop policy if exists ptt_directory_users_select on public.ptt_directory_users;
create policy ptt_directory_users_select
  on public.ptt_directory_users
  for select
  to anon, authenticated
  using (
    tenant_id = public.require_session_tenant_id()
    and (
      public.is_super_admin_profile(public.current_session_profile_id())
      or exists (
        select 1
        from public.ptt_directory_users me
        where me.tenant_id = ptt_directory_users.tenant_id
          and me.profile_id = public.current_session_profile_id()
          and me.is_active = true
      )
    )
  );

create or replace function public.ptt_is_directory_member(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ptt_directory_users d
    where d.tenant_id = public.require_session_tenant_id()
      and d.profile_id = p_profile_id
      and d.is_active = true
  );
$$;

create or replace function public.can_use_ptt_walkie()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
begin
  if v_profile is null then
    return false;
  end if;
  if public.is_super_admin_profile(v_profile) then
    return true;
  end if;
  return public.ptt_is_directory_member(v_profile);
end;
$$;

grant execute on function public.can_use_ptt_walkie() to anon, authenticated;

create or replace function public.list_ptt_directory_peers()
returns table (
  profile_id uuid,
  full_name text
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

  if not public.can_use_ptt_walkie() then
    return;
  end if;

  return query
  select
    d.profile_id,
    coalesce(nullif(trim(p.full_name), ''), 'Voluntário') as full_name
  from public.ptt_directory_users d
  join public.profiles p on p.id = d.profile_id
  where d.tenant_id = v_tenant
    and d.is_active = true
    and d.profile_id <> v_profile
  order by lower(coalesce(p.full_name, '')) asc;
end;
$$;

grant execute on function public.list_ptt_directory_peers() to anon, authenticated;

create or replace function public.list_ptt_directory_users()
returns table (
  id uuid,
  profile_id uuid,
  full_name text,
  is_active boolean,
  created_at timestamptz
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

  if not (
    public.is_super_admin_profile(v_profile)
    or public.ptt_is_directory_member(v_profile)
  ) then
    return;
  end if;

  return query
  select
    d.id,
    d.profile_id,
    coalesce(nullif(trim(p.full_name), ''), 'Voluntário') as full_name,
    d.is_active,
    d.created_at
  from public.ptt_directory_users d
  join public.profiles p on p.id = d.profile_id
  where d.tenant_id = v_tenant
  order by d.is_active desc, lower(coalesce(p.full_name, '')) asc;
end;
$$;

grant execute on function public.list_ptt_directory_users() to anon, authenticated;

create or replace function public.add_ptt_directory_user(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_id uuid;
begin
  if v_actor is null or p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  if not public.is_super_admin_profile(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Somente super admin pode incluir usuários no Walkie.');
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_profile_id and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado neste tenant.');
  end if;

  insert into public.ptt_directory_users (tenant_id, profile_id, is_active, created_by)
  values (v_tenant, p_profile_id, true, v_actor)
  on conflict (tenant_id, profile_id) do update
    set is_active = true
  returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

grant execute on function public.add_ptt_directory_user(uuid) to anon, authenticated;

create or replace function public.set_ptt_directory_user_active(
  p_profile_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_n int := 0;
begin
  if v_actor is null or p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  if not public.is_super_admin_profile(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Somente super admin pode alterar a lista Walkie.');
  end if;

  update public.ptt_directory_users d
     set is_active = coalesce(p_is_active, false)
   where d.tenant_id = v_tenant
     and d.profile_id = p_profile_id;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('success', false, 'message', 'Usuário não está na lista.');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.set_ptt_directory_user_active(uuid, boolean)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enviar para um peer escolhido no diretório (ou continuar conversa)
-- ---------------------------------------------------------------------------
create or replace function public.send_ptt_directory_message(
  p_remetente text,
  p_peer_profile_id uuid default null,
  p_setor text default 'Walkie-Talkie',
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
  v_remetente text := nullif(trim(coalesce(p_remetente, '')), '');
  v_setor text := coalesce(nullif(trim(p_setor), ''), 'Walkie-Talkie');
  v_texto text := coalesce(trim(p_texto_transcrito), '');
  v_ts text := coalesce(
    nullif(trim(p_timestamp), ''),
    to_char(timezone('America/Sao_Paulo', now()), 'HH24:MI:SS')
  );
  v_payload jsonb;
  v_peer uuid := p_peer_profile_id;
  v_conv_id uuid;
  v_new_id uuid;
  v_open_peer uuid;
begin
  if v_sender is null then
    return jsonb_build_object('success', false, 'message', 'Sessão sem perfil. Faça login novamente.');
  end if;

  if not public.can_use_ptt_walkie() then
    return jsonb_build_object(
      'success', false,
      'message', 'Você não está na lista de usuários do Walkie-Talkie.'
    );
  end if;

  if v_remetente is null then
    v_remetente := public.ptt_profile_display_name(v_sender);
  end if;

  v_payload := jsonb_build_object(
    'remetente', v_remetente,
    'setor', v_setor,
    'audio_url', coalesce(p_audio_url, ''),
    'texto_transcrito', v_texto,
    'timestamp', v_ts
  );

  -- Continuar conversa explícita
  if p_conversation_id is not null then
    select c.id, public.ptt_other_participant(c.id, v_sender)
      into v_conv_id, v_peer
    from public.ptt_conversations c
    where c.id = p_conversation_id
      and c.tenant_id = v_tenant
      and c.status = 'open'
      and (c.initiator_profile_id = v_sender or c.peer_profile_id = v_sender)
    limit 1;

    if v_conv_id is null or v_peer is null or v_peer = v_sender then
      return jsonb_build_object('success', false, 'message', 'Conversa inativa ou inválida.');
    end if;
  elsif v_peer is not null then
    if v_peer = v_sender then
      return jsonb_build_object('success', false, 'message', 'Escolha outro usuário para conversar.');
    end if;

    if not public.ptt_is_directory_member(v_peer) then
      return jsonb_build_object(
        'success', false,
        'message', 'O destinatário não está na lista do Walkie-Talkie.'
      );
    end if;

    -- Reutilizar conversa aberta entre o par (qualquer lado initiator)
    select c.id into v_conv_id
    from public.ptt_conversations c
    where c.tenant_id = v_tenant
      and c.status = 'open'
      and (
        (c.initiator_profile_id = v_sender and c.peer_profile_id = v_peer)
        or (c.initiator_profile_id = v_peer and c.peer_profile_id = v_sender)
      )
    order by c.last_message_at desc
    limit 1;

    if v_conv_id is null then
      insert into public.ptt_conversations (
        tenant_id, initiator_profile_id, peer_profile_id, status, last_message_at
      ) values (
        v_tenant, v_sender, v_peer, 'open', now()
      )
      returning id into v_conv_id;
    end if;
  else
    -- Sem peer: continua a conversa aberta mais recente do usuário
    select c.id,
           case
             when c.initiator_profile_id = v_sender then c.peer_profile_id
             else c.initiator_profile_id
           end
      into v_conv_id, v_open_peer
    from public.ptt_conversations c
    where c.tenant_id = v_tenant
      and c.status = 'open'
      and (c.initiator_profile_id = v_sender or c.peer_profile_id = v_sender)
      and c.initiator_profile_id <> c.peer_profile_id
    order by c.last_message_at desc
    limit 1;

    if v_conv_id is null then
      return jsonb_build_object(
        'success', false,
        'message', 'Escolha com quem deseja conversar no Walkie-Talkie.'
      );
    end if;
    v_peer := v_open_peer;
  end if;

  insert into public.ptt_messages (
    tenant_id, sender_profile_id, recipient_profile_id, conversation_id,
    remetente, setor, audio_path, audio_url, texto_transcrito, payload
  ) values (
    v_tenant, v_sender, v_peer, v_conv_id,
    v_remetente, v_setor,
    nullif(trim(coalesce(p_audio_path, '')), ''),
    nullif(trim(coalesce(p_audio_url, '')), ''),
    v_texto,
    v_payload || jsonb_build_object('conversation_id', v_conv_id)
  ) returning id into v_new_id;

  update public.ptt_conversations
     set last_message_at = now()
   where id = v_conv_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Mensagem enviada no diálogo Walkie-Talkie.',
    'recipient_count', 1,
    'message_ids', to_jsonb(ARRAY[v_new_id]),
    'conversation_ids', to_jsonb(ARRAY[v_conv_id]),
    'conversation_id', v_conv_id,
    'payload', v_payload || jsonb_build_object('conversation_id', v_conv_id)
  );
end;
$$;

grant execute on function public.send_ptt_directory_message(text, uuid, text, text, text, text, text, uuid)
  to anon, authenticated;

-- Compat: antigo send_ptt_estacionamento_message agora exige peer (ou conversa)
drop function if exists public.send_ptt_estacionamento_message(text, text, text, text, text, text, uuid);

create or replace function public.send_ptt_estacionamento_message(
  p_remetente text,
  p_setor text default 'Walkie-Talkie',
  p_audio_url text default null,
  p_audio_path text default null,
  p_texto_transcrito text default '',
  p_timestamp text default null,
  p_conversation_id uuid default null,
  p_peer_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.send_ptt_directory_message(
    p_remetente,
    p_peer_profile_id,
    coalesce(nullif(trim(p_setor), ''), 'Walkie-Talkie'),
    p_audio_url,
    p_audio_path,
    p_texto_transcrito,
    p_timestamp,
    p_conversation_id
  );
end;
$$;

grant execute on function public.send_ptt_estacionamento_message(text, text, text, text, text, text, uuid, uuid)
  to anon, authenticated;

commit;
