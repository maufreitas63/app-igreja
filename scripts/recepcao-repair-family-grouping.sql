-- Reparo pontual: unifica family_id de integrantes do mesmo lote na recepção já processada.
-- Execute no SQL Editor do Supabase APÓS atualizar scripts/recepcao-cadastro-familiar.sql.
--
-- Uso:
--   select public.repair_recepcao_processed_family_grouping();
--
-- O retorno JSON informa quantos lotes e quantas linhas (profiles/members) foram corrigidos.

select public.repair_recepcao_processed_family_grouping() as repair_result;
