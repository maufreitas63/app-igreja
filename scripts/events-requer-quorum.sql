-- Requer Quorum: audiência individual só para o usuário ativo (Painel de Eventos).
-- Execute UMA VEZ no SQL Editor do Supabase (idempotente).

alter table public.events
  add column if not exists requer_quorum boolean;

update public.events
set requer_quorum = false
where requer_quorum is null;

alter table public.events
  alter column requer_quorum set default false,
  alter column requer_quorum set not null;

comment on column public.events.requer_quorum is
  'Quando true, audiência individual no painel e registro cronológico em event_quorum_registry (scripts/events-quorum-registry.sql).';

create or replace function public.ensure_events_requer_quorum_column()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.events
    add column if not exists requer_quorum boolean;

  update public.events
  set requer_quorum = false
  where requer_quorum is null;

  alter table public.events
    alter column requer_quorum set default false,
    alter column requer_quorum set not null;

  return true;
end;
$$;

grant execute on function public.ensure_events_requer_quorum_column() to anon, authenticated, service_role;
