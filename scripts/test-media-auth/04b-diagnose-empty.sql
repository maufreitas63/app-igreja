-- TESTE 4b — Por que o 04 está vazio?
-- O teste 03/03b NÃO cria pendência. Só o envio pelo APP cria linha em pending_authorizations.

with params as (
  select 'maufreitas63@gmail.com'::text as email_filter  -- ajuste se necessário
)
select
  (select count(*) from public.pending_authorizations) as total_pendentes,
  (select count(*) from public.authorizations) as total_confirmadas,
  (
    select count(*)
      from public.pending_authorizations p
     cross join params x
     where lower(p.email) = lower(x.email_filter)
  ) as pendentes_do_email,
  (
    select count(*)
      from public.authorizations a
     cross join params x
     where lower(a.email) = lower(x.email_filter)
  ) as confirmadas_do_email;

-- Últimas confirmadas (se já concluiu o fluxo, o 04 fica vazio de propósito)
with params as (
  select 'maufreitas63@gmail.com'::text as email_filter
)
select
  a.id,
  a.email,
  a.accepted_at,
  'CONFIRMADA' as situacao
from public.authorizations a
cross join params x
where lower(a.email) = lower(x.email_filter)
order by a.accepted_at desc
limit 5;
