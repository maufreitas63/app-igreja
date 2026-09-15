-- Configuração manual da chave Gemini (alternativa à tela do super admin no app).
-- Prefira: Manutenção → Assistente IA → aba "Chave API" (super admin).
--
-- Use este script só se a igreja preferir gravar via SQL Editor do Supabase.
-- A chave deve ser criada na conta Google DA IGREJA: https://aistudio.google.com/apikey
-- Não commite este arquivo com a chave real no Git.

insert into public.ai_server_config (config_key, config_value)
values ('gemini_api_key', 'COLE_A_CHAVE_DA_IGREJA_AQUI')
on conflict (config_key) do update
  set config_value = excluded.config_value,
      updated_at = now();
