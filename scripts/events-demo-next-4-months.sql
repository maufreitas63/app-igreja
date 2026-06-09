-- Eventos fictícios: 3 por mês nos próximos 4 meses (a partir da data de execução).
-- Prefixo [DEMO] para identificar e remover depois.
-- Execute após: events-totem-ativo.sql (coluna totem_ativo) e events-maintenance-rls.sql

-- Reexecutar com segurança
delete from public.events
where name like '[DEMO]%';

insert into public.events (
  name,
  event_date,
  event_local,
  max_capacity,
  kids_room,
  teens_room,
  parm_ofertas,
  totem_ativo,
  is_locked
)
values
  -- Mês 1
  (
    '[DEMO] Culto Dominical — Junho',
    (date_trunc('month', current_date) + interval '7 days' + time '10:00')::timestamptz,
    'Templo Principal',
    350,
    true,
    true,
    true,
    true,
    false
  ),
  (
    '[DEMO] Encontro IBN Teens — Junho',
    (date_trunc('month', current_date) + interval '18 days' + time '19:30')::timestamptz,
    'Auditório IBN',
    120,
    false,
    true,
    false,
    false,
    false
  ),
  (
    '[DEMO] Café com Famílias — Junho',
    (date_trunc('month', current_date) + interval '26 days' + time '15:00')::timestamptz,
    'Salão Social',
    80,
    true,
    false,
    true,
    false,
    false
  ),

  -- Mês 2
  (
    '[DEMO] Culto Dominical — Mês 2',
    (date_trunc('month', current_date) + interval '1 month' + interval '6 days' + time '10:00')::timestamptz,
    'Templo Principal',
    400,
    true,
    true,
    true,
    false,
    false
  ),
  (
    '[DEMO] Acampamento Kids — Mês 2',
    (date_trunc('month', current_date) + interval '1 month' + interval '17 days' + time '09:00')::timestamptz,
    'Campus Kids',
    150,
    true,
    false,
    false,
    true,
    false
  ),
  (
    '[DEMO] Noite de Oração — Mês 2',
    (date_trunc('month', current_date) + interval '1 month' + interval '24 days' + time '20:00')::timestamptz,
    'Capela de Oração',
    250,
    false,
    false,
    true,
    false,
    false
  ),

  -- Mês 3
  (
    '[DEMO] Culto Dominical — Mês 3',
    (date_trunc('month', current_date) + interval '2 months' + interval '5 days' + time '10:00')::timestamptz,
    'Auditório IBN',
    380,
    true,
    false,
    true,
    true,
    false
  ),
  (
    '[DEMO] IBN Teens Live — Mês 3',
    (date_trunc('month', current_date) + interval '2 months' + interval '16 days' + time '19:00')::timestamptz,
    'Salão Teens',
    180,
    false,
    true,
    false,
    false,
    false
  ),
  (
    '[DEMO] Batismo e Ceia — Mês 3',
    (date_trunc('month', current_date) + interval '2 months' + interval '28 days' + time '18:00')::timestamptz,
    'Templo Principal',
    450,
    true,
    true,
    true,
    true,
    false
  ),

  -- Mês 4
  (
    '[DEMO] Culto Dominical — Mês 4',
    (date_trunc('month', current_date) + interval '3 months' + interval '7 days' + time '10:00')::timestamptz,
    'Templo Principal',
    320,
    true,
    true,
    false,
    false,
    false
  ),
  (
    '[DEMO] Dia das Crianças IBN — Mês 4',
    (date_trunc('month', current_date) + interval '3 months' + interval '14 days' + time '14:00')::timestamptz,
    'Campus Kids',
    100,
    true,
    false,
    true,
    false,
    false
  ),
  (
    '[DEMO] Conferência de Famílias — Mês 4',
    (date_trunc('month', current_date) + interval '3 months' + interval '25 days' + time '16:30')::timestamptz,
    'Salão Social',
    220,
    false,
    false,
    true,
    true,
    false
  );

-- Conferência rápida
select
  name,
  event_date,
  event_local,
  max_capacity,
  kids_room,
  teens_room,
  parm_ofertas,
  totem_ativo,
  is_locked
from public.events
where name like '[DEMO]%'
order by event_date;
