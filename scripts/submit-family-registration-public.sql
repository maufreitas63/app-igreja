-- A RPC `public.submit_family_registration_public` foi movida para a fila de recepção.
--
-- Execute no SQL Editor do Supabase (após register-member-atomic.sql):
--   scripts/recepcao-cadastro-familiar.sql
--
-- O formulário público grava em recepcao_cadastro_familiar_* e a equipe promove
-- para profiles/members via process_recepcao_cadastro_familiar_batch.

select
  'Use scripts/recepcao-cadastro-familiar.sql para instalar ou atualizar o fluxo de recepção do cadastro familiar.'
  as info;
