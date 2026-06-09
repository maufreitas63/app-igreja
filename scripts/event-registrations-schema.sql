-- Ajuste de schema para armazenar o identificador da familia
-- e o nome completo do participante em cada registro de evento.
--
-- Execute no SQL Editor do Supabase do projeto.

alter table public.event_registrations
  add column if not exists family_id text,
  add column if not exists full_name text;

comment on column public.event_registrations.family_id is
  'Identificador da familia associado ao participante no momento do registro do evento.';

comment on column public.event_registrations.full_name is
  'Nome completo do participante no momento do registro do evento.';

create index if not exists idx_event_registrations_family_id
  on public.event_registrations (family_id);

create index if not exists idx_event_registrations_full_name
  on public.event_registrations (full_name);

-- Importante:
-- O app atualmente registra participantes via RPC `register_member_atomic`.
-- Depois de aplicar este ALTER TABLE, a RPC tambem precisa ser ajustada
-- para preencher `family_id` e `full_name` durante o insert em
-- `public.event_registrations`.
