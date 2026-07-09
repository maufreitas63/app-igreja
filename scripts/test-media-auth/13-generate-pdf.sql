-- TESTE 13 — Gerar PDF para autorização já confirmada
-- 1. Rode 05-list-confirmed.sql e copie o id (UUID)
-- 2. Substitua SOMENTE na linha abaixo (mantenha as aspas simples)
-- 3. Execute APENAS o SELECT (não cole comentários no editor)

select public.invoke_media_authorization_pdf_generation(
  '08e279aa-9341-4cc7-86ff-d1d1f6b2fc01'::uuid
) as resultado;
