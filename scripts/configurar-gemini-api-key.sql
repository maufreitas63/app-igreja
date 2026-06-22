-- Configurar chave Gemini para o Assistente IA (alternativa ao GEMINI_API_KEY no Cloudflare).
-- Execute no SQL Editor do Supabase APÓS access-control-ai-curator.sql (ou o patch cloudflare).
--
-- 1. Substitua COLE_SUA_CHAVE_GEMINI_AQUI pela chave de https://aistudio.google.com/apikey
-- 2. Não commite este arquivo com a chave real no Git.

insert into public.ai_server_config (config_key, config_value)
values ('gemini_api_key', 'COLE_SUA_CHAVE_GEMINI_AQUI')
on conflict (config_key) do update
  set config_value = excluded.config_value,
      updated_at = now();
