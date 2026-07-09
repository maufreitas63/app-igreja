-- TESTE 4 — Pendências de autorização (links ainda não confirmados)
-- Execute após enviar pelo app OU após teste 3.
-- Substitua o e-mail ou deixe null para listar todos.

with params as (
  select null::text as email_filter  -- ex.: 'seu@email.com'
)
select
  p.id,
  p.profile_id,
  p.email,
  p.created_at,
  p.expires_at,
  left(p.token, 10) || '...' as token_prefix,
  case
    when p.expires_at < now() then 'EXPIRADO'
    else 'VALIDO'
  end as status
from public.pending_authorizations p
cross join params x
where x.email_filter is null
   or lower(p.email) = lower(x.email_filter)
order by p.created_at desc
limit 20;
