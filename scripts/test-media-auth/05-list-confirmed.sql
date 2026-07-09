-- TESTE 5 — Autorizações já confirmadas
-- Substitua o e-mail ou deixe null para listar todos.

with params as (
  select null::text as email_filter  -- ex.: 'seu@email.com'
)
select
  a.id,
  a.full_name,
  a.email,
  a.accepted_at,
  a.confirmed_via_email,
  a.storage_path,
  left(coalesce(a.confirmation_token, ''), 10) || '...' as token_prefix
from public.authorizations a
cross join params x
where x.email_filter is null
   or lower(a.email) = lower(x.email_filter)
order by a.accepted_at desc
limit 20;
