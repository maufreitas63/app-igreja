-- TESTE 6 — Validar token copiado do link do e-mail
-- Cole o valor completo após "token=" na URL.

with params as (
  select 'COLE_O_TOKEN_AQUI'::text as token_from_url
)
select
  public.normalize_media_authorization_token((select token_from_url from params)) as token_normalizado,
  p.id as pending_id,
  p.email,
  p.created_at,
  p.expires_at,
  case
    when p.id is null then 'NAO ENCONTRADO — link inválido ou já usado'
    when p.expires_at < now() then 'EXPIRADO'
    else 'VALIDO — pode confirmar no app'
  end as status
from params x
left join public.pending_authorizations p
  on p.token = public.normalize_media_authorization_token(x.token_from_url);
