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

-- Funções RPC / helpers (todas as assinaturas conhecidas)
drop function if exists public.send_ptt_directory_message(text, uuid, text, text, text, text, text, uuid);
drop function if exists public.send_ptt_estacionamento_message(text, text, text, text, text, text, uuid, uuid);
drop function if exists public.send_ptt_estacionamento_message(text, text, text, text, text, text, uuid);
drop function if exists public.send_ptt_estacionamento_message(text, text, text, text, text, text);
drop function if exists public.reply_ptt_conversation(uuid, text, text, text, text);
drop function if exists public.end_ptt_conversation(uuid);
drop function if exists public.list_open_ptt_conversations();
drop function if exists public.list_ptt_conversation_messages(uuid);
drop function if exists public.get_ptt_conversation(uuid);
drop function if exists public.ack_ptt_conversation_messages(uuid);
drop function if exists public.list_pending_ptt_messages();
drop function if exists public.ack_ptt_message(uuid);
drop function if exists public.mark_ptt_message_delivered(uuid);
drop function if exists public.can_use_ptt_walkie();
drop function if exists public.list_ptt_directory_peers();
drop function if exists public.list_ptt_directory_users();
drop function if exists public.add_ptt_directory_user(uuid);
drop function if exists public.set_ptt_directory_user_active(uuid, boolean);
drop function if exists public.ptt_is_directory_member(uuid);
drop function if exists public.ptt_list_acolhimento_recepcao_recipients(uuid, date);
drop function if exists public.ptt_other_participant(uuid, uuid);
drop function if exists public.ptt_profile_display_name(uuid);
drop function if exists public.ptt_service_date_today();
drop function if exists public.ptt_normalize_name(text);

-- Tabelas (CASCADE remove índices/policies dependentes)
drop table if exists public.ptt_directory_users cascade;
drop table if exists public.ptt_conversations cascade;
drop table if exists public.ptt_messages cascade;
