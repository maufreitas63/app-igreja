-- TESTE 11 — Contexto do submit (rode com o app aberto: F12 → Console)
-- No SQL Editor não há headers: resolvedProfileId fica null (esperado).
-- No app, antes de enviar, execute no console do navegador:
--
--   const { supabase } = await import('/caminho...');  -- ou use a aba Network na chamada RPC
--
-- Melhor: após clicar Enviar, veja a resposta de submit_media_authorization_pending na aba Network.

select public.debug_media_authorization_submit_context() as contexto_sql_editor;
