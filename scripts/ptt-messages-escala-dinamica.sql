-- =============================================================================
-- PTT Walkie-Talkie — mensagens com roteamento por escala do dia
-- =============================================================================
-- Execute TODO este arquivo no SQL Editor do Supabase.
--
-- Roteamento: remetente Estacionamento → servos em disponibilidade do
-- Ministério De Acolhimento (`ministerioacolhimento` / voluntarios_escala.is_ativo).
-- NÃO usa escalas_log do dia nem só acolhimento_recepcao.
-- Perfil do destinatário: match de nome (voluntarios_escala.nome ↔ profiles.full_name).
-- =============================================================================

begin;

create table if not exists public.ptt_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas(id) on delete cascade,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  remetente text not null,
  setor text not null default 'Estacionamento',
  audio_path text,
  audio_url text,
  texto_transcrito text not null default '',
  payload jsonb not null default '{}'::jsonb,
  delivered_at timestamptz,
  acked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ptt_messages_recipient_pending_idx
  on public.ptt_messages (tenant_id, recipient_profile_id, created_at desc)
  where acked_at is null;

create index if not exists ptt_messages_created_idx
  on public.ptt_messages (tenant_id, created_at desc);

alter table public.ptt_messages enable row level security;

drop policy if exists ptt_messages_select_own on public.ptt_messages;
create policy ptt_messages_select_own
  on public.ptt_messages
  for select
  to anon, authenticated
  using (
    recipient_profile_id = public.current_session_profile_id()
    or sender_profile_id = public.current_session_profile_id()
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

drop policy if exists ptt_messages_insert_sender on public.ptt_messages;
create policy ptt_messages_insert_sender
  on public.ptt_messages
  for insert
  to anon, authenticated
  with check (
    sender_profile_id = public.current_session_profile_id()
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

drop policy if exists ptt_messages_update_recipient on public.ptt_messages;
create policy ptt_messages_update_recipient
  on public.ptt_messages
  for update
  to anon, authenticated
  using (
    recipient_profile_id = public.current_session_profile_id()
    or public.is_super_admin_profile(public.current_session_profile_id())
  )
  with check (
    recipient_profile_id = public.current_session_profile_id()
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

-- Storage de áudio (público ler URL; insert autenticado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ptt-audio',
  'ptt-audio',
  true,
  10485760,
  array['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a', 'audio/aac']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ptt_audio_storage_select on storage.objects;
create policy ptt_audio_storage_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'ptt-audio');

drop policy if exists ptt_audio_storage_insert on storage.objects;
create policy ptt_audio_storage_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'ptt-audio'
    and public.current_session_profile_id() is not null
  );

create or replace function public.ptt_service_date_today()
returns date
language sql
stable
set search_path = public
as $$
  select (timezone('America/Sao_Paulo', now()))::date;
$$;

create or replace function public.ptt_normalize_name(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(trim(regexp_replace(coalesce(p_value, ''), '\s+', ' ', 'g')));
$$;

-- Destinatários = pool "Servos em Disponibilidade" do Ministério De Acolhimento
-- (p_service_date mantido por compatibilidade; o pool ativo não depende da data).
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
  -- parâmetro legado (roteamento atual é por disponibilidade, não por data)
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

create or replace function public.list_pending_ptt_messages()
returns setof public.ptt_messages
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
  v_tenant uuid := public.require_session_tenant_id();
begin
  if v_profile is null then
    return;
  end if;

  return query
  select m.*
  from public.ptt_messages m
  where m.tenant_id = v_tenant
    and m.recipient_profile_id = v_profile
    and m.acked_at is null
  order by m.created_at asc;
end;
$$;

grant execute on function public.list_pending_ptt_messages() to anon, authenticated;

create or replace function public.ack_ptt_message(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
begin
  if v_profile is null or p_message_id is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  update public.ptt_messages m
     set acked_at = coalesce(m.acked_at, now()),
         delivered_at = coalesce(m.delivered_at, now())
   where m.id = p_message_id
     and m.recipient_profile_id = v_profile;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Mensagem não encontrada.');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.ack_ptt_message(uuid) to anon, authenticated;

create or replace function public.mark_ptt_message_delivered(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_session_profile_id();
begin
  update public.ptt_messages m
     set delivered_at = coalesce(m.delivered_at, now())
   where m.id = p_message_id
     and m.recipient_profile_id = v_profile;

  return jsonb_build_object('success', found);
end;
$$;

grant execute on function public.mark_ptt_message_delivered(uuid) to anon, authenticated;

-- Realtime (ignora se já publicado)
do $$
begin
  alter publication supabase_realtime add table public.ptt_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
