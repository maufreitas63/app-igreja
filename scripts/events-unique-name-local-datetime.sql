-- =============================================================================
-- Impede eventos duplicados (mesmo tenant + nome + local + data/hora)
-- =============================================================================
-- Sintoma: dois lançamentos iguais na lista (ex. mesmo culto/local/horário).
--
-- Critério de unicidade (igual ao app):
--   tenant_id
--   + lower(trim(name))
--   + coalesce(lower(trim(event_local)), '')
--   + event_date
--
-- Execute TODO este arquivo no SQL Editor do Supabase.
-- 1) Lista grupos duplicados
-- 2) Remove cópias vazias (sem inscrição e sem check-in), mantendo 1 por grupo
-- 3) Cria índice único (falha se ainda houver duplicata com dados)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Diagnóstico — grupos com mais de um evento
-- ---------------------------------------------------------------------------
select
  e.tenant_id,
  lower(trim(e.name)) as name_key,
  coalesce(lower(trim(e.event_local)), '') as local_key,
  e.event_date,
  count(*) as qtd,
  array_agg(e.id order by e.id) as event_ids
from public.events e
group by 1, 2, 3, 4
having count(*) > 1
order by e.event_date desc;

-- ---------------------------------------------------------------------------
-- 2) Remover duplicatas vazias (mantém o id “preferido” do grupo)
--    Preferência: mais inscrições → mais check-ins → id lexicograficamente menor
-- ---------------------------------------------------------------------------
with ranked as (
  select
    e.id,
    e.tenant_id,
    lower(trim(e.name)) as name_key,
    coalesce(lower(trim(e.event_local)), '') as local_key,
    e.event_date,
    coalesce((
      select count(*)::int
      from public.event_registrations er
      where er.event_id = e.id
    ), 0) as registrations_count,
    coalesce((
      select count(*)::int
      from public.checkins c
      where c.event_id = e.id
    ), 0) as checkins_count,
    row_number() over (
      partition by
        e.tenant_id,
        lower(trim(e.name)),
        coalesce(lower(trim(e.event_local)), ''),
        e.event_date
      order by
        coalesce((
          select count(*)::int
          from public.event_registrations er
          where er.event_id = e.id
        ), 0) desc,
        coalesce((
          select count(*)::int
          from public.checkins c
          where c.event_id = e.id
        ), 0) desc,
        e.id asc
    ) as rn
  from public.events e
),
duplicates as (
  select *
  from ranked
  where (tenant_id, name_key, local_key, event_date) in (
    select tenant_id, name_key, local_key, event_date
    from ranked
    group by 1, 2, 3, 4
    having count(*) > 1
  )
),
to_delete as (
  select d.id
  from duplicates d
  where d.rn > 1
    and d.registrations_count = 0
    and d.checkins_count = 0
)
delete from public.events e
where e.id in (select id from to_delete);

-- ---------------------------------------------------------------------------
-- 3) Grupos que ainda não puderam ser limpos (têm inscrição/check-in)
--    → resolva manualmente antes do índice (apague/mescle na UI)
-- ---------------------------------------------------------------------------
select
  e.tenant_id,
  lower(trim(e.name)) as name_key,
  coalesce(lower(trim(e.event_local)), '') as local_key,
  e.event_date,
  count(*) as qtd,
  array_agg(e.id order by e.id) as event_ids
from public.events e
group by 1, 2, 3, 4
having count(*) > 1
order by e.event_date desc;

-- ---------------------------------------------------------------------------
-- 4) Índice único (fonte da verdade contra corrida de clique duplo)
-- ---------------------------------------------------------------------------
do $$
declare
  v_remaining int;
begin
  select count(*)::int
    into v_remaining
  from (
    select 1
    from public.events e
    group by
      e.tenant_id,
      lower(trim(e.name)),
      coalesce(lower(trim(e.event_local)), ''),
      e.event_date
    having count(*) > 1
  ) dupes;

  if coalesce(v_remaining, 0) > 0 then
    raise exception
      'Ainda existem % grupo(s) duplicado(s) com inscrição/check-in. Remova manualmente na manutenção e rode o script de novo.',
      v_remaining;
  end if;
end $$;

create unique index if not exists events_tenant_name_local_date_uq
  on public.events (
    tenant_id,
    (lower(trim(name))),
    (coalesce(lower(trim(event_local)), '')),
    event_date
  );
