-- Corrige totem_ativo NULL e garante default false + NOT NULL.
-- Execute no SQL Editor do Supabase (após events-totem-ativo.sql).

alter table public.events
  add column if not exists totem_ativo boolean;

update public.events
set totem_ativo = false
where totem_ativo is null;

alter table public.events
  alter column totem_ativo set default false,
  alter column totem_ativo set not null;

comment on column public.events.totem_ativo is
  'Quando true, o totem/check-in associado ao evento está ativo.';
