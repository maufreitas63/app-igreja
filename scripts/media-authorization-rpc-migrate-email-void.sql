-- Migração única: só execute se aparecer erro
-- "cannot change return type of existing function" ao rodar media-authorization-rpc.sql
--
-- Depois de executar este arquivo, rode scripts/media-authorization-rpc.sql completo.

drop function if exists public.send_media_authorization_confirm_email(text, text, text);
drop function if exists public.send_media_authorization_confirm_email_via_resend(text, text, text);
drop function if exists public.send_media_authorization_confirm_email_via_gmail(text, text, text);
