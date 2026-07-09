-- TESTE 13 — Gerar PDF para autorização já confirmada
-- Substitua o UUID pela coluna id do teste 05-list-confirmed.sql

select public.invoke_media_authorization_pdf_generation(
  '00000000-0000-0000-0000-000000000000'::uuid
) as resultado;

-- Esperado: {"ok":true,"storagePath":"authorizations/.../....pdf","message":"PDF gerado com sucesso."}
-- Depois rode 05-list-confirmed.sql e confira storage_path preenchido.
