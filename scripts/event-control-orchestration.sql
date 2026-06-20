-- Orquestração em tempo real (event_control) — sinal do líder para rotas do app.
-- Execute no SQL Editor do Supabase.
-- Papel dedicado: scripts/access-control-orquestrador-evento-role.sql (após este script).

create table if not exists public.event_control (
  id integer primary key,
  active_route text not null,
  updated_at timestamptz not null default now(),
  constraint event_control_singleton check (id = 1),
  constraint event_control_active_route_check check (
    active_route in ('/home', '/ofertas', '/dizimos', '/avisos')
  )
);

insert into public.event_control (id, active_route)
values (1, '/home')
on conflict (id) do nothing;

create or replace function public.profile_is_event_control_admin(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin_profile(p_profile_id)
    or public.profile_has_role_code(p_profile_id, 'orquestrador_evento');
$$;

create or replace function public.profile_can_manage_event_control(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_is_event_control_admin(p_profile_id);
$$;

grant execute on function public.profile_can_manage_event_control(uuid) to anon, authenticated;

drop function if exists public.atualizar_event_control_rota(uuid, text);

create or replace function public.atualizar_event_control_rota(
  p_actor_profile_id uuid,
  p_active_route text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route text;
  v_row public.event_control%rowtype;
begin
  if p_actor_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_is_event_control_admin(p_actor_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Apenas orquestradores de evento podem alterar a orquestração.'
    );
  end if;

  v_route := lower(trim(coalesce(p_active_route, '')));

  if v_route not in ('/home', '/ofertas', '/dizimos', '/avisos') then
    return jsonb_build_object('success', false, 'message', 'Rota inválida para orquestração.');
  end if;

  update public.event_control
     set active_route = v_route,
         updated_at = now()
   where id = 1
  returning * into v_row;

  if not found then
    insert into public.event_control (id, active_route, updated_at)
    values (1, v_route, now())
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'success',
    true,
    'message',
    'Rota atualizada.',
    'id',
    v_row.id,
    'active_route',
    v_row.active_route,
    'updated_at',
    v_row.updated_at
  );
end;
$$;

grant execute on function public.atualizar_event_control_rota(uuid, text) to anon, authenticated;

alter table public.event_control enable row level security;

drop policy if exists event_control_select_authenticated on public.event_control;
drop policy if exists event_control_update_admin on public.event_control;

create policy event_control_select_authenticated
  on public.event_control
  for select
  to anon, authenticated
  using (true);

-- UPDATE direto bloqueado: alterações passam pela RPC security definer.
create policy event_control_update_admin
  on public.event_control
  for update
  to authenticated
  using (false)
  with check (false);

grant select on public.event_control to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.event_control;
    exception
      when duplicate_object then
        null;
    end;
  end if;
end;
$$;

notify pgrst, 'reload schema';
