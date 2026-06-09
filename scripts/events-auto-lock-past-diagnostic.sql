-- Diagnóstico: por que is_locked não atualiza?
-- Execute no SQL Editor e revise as colunas resultado.

select public.app_local_today() as hoje_sp;

select
  e.id,
  e.name,
  e.event_date,
  pg_typeof(e.event_date) as tipo_event_date,
  e.is_locked,
  public.event_local_date(e.event_date::timestamptz) as dia_evento_sp,
  public.is_event_date_in_past(e.event_date::timestamptz) as deveria_bloquear
from public.events e
where e.event_date is not null
order by e.event_date
limit 30;

select public.lock_past_events() as linhas_atualizadas;

select count(*) as ainda_desbloqueados_no_passado
from public.events e
where e.event_date is not null
  and coalesce(e.is_locked, false) = false
  and public.is_event_date_in_past(e.event_date::timestamptz);
