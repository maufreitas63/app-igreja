-- Ativação de totem por evento (formulário de manutenção + tela totem).
-- Execute UMA VEZ no SQL Editor do Supabase (idempotente).
-- Depois disso o app cria/atualiza a coluna automaticamente via RPC.

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

-- RPC: o app chama isto quando a coluna ainda não existe (SECURITY DEFINER = DDL permitido).
create or replace function public.ensure_events_totem_ativo_column()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.events
    add column if not exists totem_ativo boolean;

  update public.events
  set totem_ativo = false
  where totem_ativo is null;

  alter table public.events
    alter column totem_ativo set default false,
    alter column totem_ativo set not null;

  return true;
end;
$$;

grant execute on function public.ensure_events_totem_ativo_column() to anon, authenticated, service_role;

comment on function public.ensure_events_totem_ativo_column is
  'Garante a coluna events.totem_ativo (idempotente). Chamada pelo app na manutenção e no totem.';
