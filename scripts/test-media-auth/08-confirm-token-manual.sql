-- TESTE 8 — Confirmar autorização manualmente pelo token (sem app)
-- Use só para diagnóstico. Cole o token do e-mail mais recente.

with params as (
  select 'COLE_O_TOKEN_AQUI'::text as token_from_url
)
select public.confirm_media_authorization(
  public.normalize_media_authorization_token((select token_from_url from params)),
  null,
  'diagnostico-sql'
) as resultado;

-- Esperado: {"ok":true,"message":"Autorização confirmada com sucesso.",...}
-- Ou: {"ok":true,"alreadyConfirmed":true,...} se já confirmou antes
