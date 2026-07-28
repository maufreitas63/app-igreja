-- Remoção completa do módulo Walkie-Talkie / PTT no Supabase.
-- Execute no SQL Editor (uma vez). Seguro com IF EXISTS.
--
-- Bucket de áudio: NÃO apague via SQL (bloqueado pelo Storage).
-- No Dashboard: Storage → bucket "ptt-audio" → Delete bucket
-- (ou esvazie os arquivos e remova o bucket pela UI).

-- Políticas de storage do áudio PTT
drop policy if exists ptt_audio_storage_select on storage.objects;
drop policy if exists ptt_audio_storage_insert on storage.objects;
drop policy if exists ptt_audio_storage_update on storage.objects;
drop policy if exists ptt_audio_storage_delete on storage.objects;

-- Todas as funções PTT (qualquer assinatura), respeitando dependências
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as func_name,
      pg_get_function_identity_arguments(p.oid) as func_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like 'ptt\_%' escape '\'
        or p.proname like '%\_ptt\_%' escape '\'
        or p.proname like 'ptt%'
        or p.proname in (
          'can_use_ptt_walkie',
          'list_ptt_directory_peers',
          'list_ptt_directory_users',
          'add_ptt_directory_user',
          'set_ptt_directory_user_active',
          'send_ptt_directory_message',
          'send_ptt_estacionamento_message',
          'reply_ptt_conversation',
          'end_ptt_conversation',
          'list_open_ptt_conversations',
          'list_ptt_conversation_messages',
          'get_ptt_conversation',
          'ack_ptt_conversation_messages',
          'list_pending_ptt_messages',
          'ack_ptt_message',
          'mark_ptt_message_delivered'
        )
      )
  loop
    execute format(
      'drop function if exists %I.%I(%s) cascade',
      r.schema_name,
      r.func_name,
      r.func_args
    );
  end loop;
end $$;

-- Tabelas (CASCADE remove índices/policies dependentes)
drop table if exists public.ptt_directory_users cascade;
drop table if exists public.ptt_conversations cascade;
drop table if exists public.ptt_messages cascade;
