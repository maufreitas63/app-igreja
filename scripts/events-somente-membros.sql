-- Visibilidade restrita a membros ativos no painel de eventos do dashboard.
-- Execute UMA VEZ no SQL Editor do Supabase (idempotente).

alter table public.events
  add column if not exists somente_membros boolean;

update public.events
set somente_membros = false
where somente_membros is null;

alter table public.events
  alter column somente_membros set default false,
  alter column somente_membros set not null;

comment on column public.events.somente_membros is
  'Quando true, o evento publicado só aparece para perfis ativos na lista de membros (profile_is_members_list_member).';

create or replace function public.ensure_events_somente_membros_column()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.events
    add column if not exists somente_membros boolean;

  update public.events
  set somente_membros = false
  where somente_membros is null;

  alter table public.events
    alter column somente_membros set default false,
    alter column somente_membros set not null;

  return true;
end;
$$;

grant execute on function public.ensure_events_somente_membros_column() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
